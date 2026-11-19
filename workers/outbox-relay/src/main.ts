// Drains core.outbox into NATS JetStream. At-least-once: the row is marked published only after
// JetStream acks; Nats-Msg-Id = event_id lets JetStream drop the duplicate if we crash in between.
import { connect } from 'nats';
import postgres from 'postgres';
import { STREAM_NAME, STREAM_SUBJECTS } from '@grabcode/contracts/schemas';

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 500);
const BATCH = 100;

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://grabcode:grabcode@127.0.0.1:5433/grabcode');
const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
const jsm = await nc.jetstreamManager();
// add is a no-op for an identical config; update picks up subjects added to the contract later.
await jsm.streams
  .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
  .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
const js = nc.jetstream();

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => (stopping = true));

async function drainOnce(): Promise<number> {
  // SKIP LOCKED lets several relay replicas run without double-publishing the same batch.
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; event_id: string; subject: string; payload: unknown }[]>`
      select id, event_id, subject, payload from core.outbox
      where published_at is null order by id limit ${BATCH} for update skip locked`;
    for (const r of rows) {
      await js.publish(r.subject, JSON.stringify(r.payload), { msgID: r.event_id });
      await tx`update core.outbox set published_at = now() where id = ${r.id}`;
    }
    return rows.length;
  });
}

console.log('outbox-relay started');
while (!stopping) {
  try {
    const n = await drainOnce();
    if (n) console.log(`relayed ${n} event(s)`);
    if (n < BATCH) await new Promise((r) => setTimeout(r, POLL_MS));
  } catch (err) {
    console.error('relay error', err);
    await new Promise((r) => setTimeout(r, POLL_MS * 4));
  }
}
await nc.drain();
await sql.end();
