// Consumes order.*, dispatch.offered and chat.posted, sends WebPush to the users the event concerns (noticesFor) whose
// notifications.push is on, to every browser they subscribed (core.push_subscriptions, written by core-api).
// Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys); without them it acks and skips.
// Idempotent via notifier.processed_events. Zalo ZNS / FCM / email are not wired yet.
import { AckPolicy, connect, type JsMsg } from 'nats';
import postgres from 'postgres';
import webpush from 'web-push';
import { ChatPostedEventSchema, DispatchEventSchema, OrderEventSchema, STREAM_NAME, STREAM_SUBJECTS, SUBJECTS } from '@grabcode/contracts/schemas';
import { noticesFor } from './messages';

const DURABLE = 'notifier';
const MAX_DELIVER = 4;
const { VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: PRIV } = process.env;
const enabled = Boolean(PUB && PRIV);
if (enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ops@grabcode.local', PUB!, PRIV!);

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://grabcode:grabcode@127.0.0.1:5433/grabcode', { onnotice: () => {} });
await sql`create schema if not exists notifier`;
await sql`create table if not exists notifier.processed_events (
  event_id text primary key, processed_at timestamptz not null default now())`;

const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
const jsm = await nc.jetstreamManager();
await jsm.streams
  .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
  .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
const filter_subjects = ['order.>', SUBJECTS.DISPATCH_OFFERED, SUBJECTS.CHAT_POSTED];
await jsm.consumers
  // New consumer starts at new events: no push storm for history.
  .add(STREAM_NAME, { durable_name: DURABLE, ack_policy: AckPolicy.Explicit, filter_subjects, max_deliver: MAX_DELIVER, deliver_policy: 'new' as never })
  .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subjects }));
const js = nc.jetstream();

interface Sub { endpoint: string; p256dh: string; auth: string }

// shortcut: reads/prunes core.push_subscriptions + users.notifications directly (core-api owns them); move behind an event if modules split DBs.
async function subsFor(userIds: string[]): Promise<Sub[]> {
  return sql<Sub[]>`select s.endpoint, s.p256dh, s.auth from core.push_subscriptions s join core.users u on u.id = s.user_id
    where s.user_id = any(${userIds}::uuid[]) and coalesce((u.notifications->>'push')::boolean, true)`;
}

/** Throws on a transient failure (retry the event); a gone endpoint is pruned, not retried. */
async function send(sub: Sub, payload: string) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 });
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return void (await sql`delete from core.push_subscriptions where endpoint = ${sub.endpoint}`);
    if (status && status < 500 && status !== 429) return console.warn(`push rejected ${status}: ${(err as { body?: string }).body ?? ''}`);
    throw err;
  }
}

async function handle(m: JsMsg) {
  const raw = m.json<{ type: string }>();
  const event =
    raw.type === SUBJECTS.DISPATCH_OFFERED ? DispatchEventSchema.parse(raw)
    : raw.type === SUBJECTS.CHAT_POSTED ? ChatPostedEventSchema.parse(raw)
    : OrderEventSchema.parse(raw);
  const [seen] = await sql`select 1 from notifier.processed_events where event_id = ${event.event_id}`;
  if (seen) return m.ack();
  if (enabled) {
    try {
      for (const n of noticesFor(event)) {
        const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: `${event.data.orderId}:${event.type}` });
        for (const s of await subsFor(n.userIds)) await send(s, payload);
      }
    } catch (err) {
      // shortcut: a retry resends to browsers already notified in this event; fine at our volume, track per-endpoint if it annoys.
      if (m.info.deliveryCount < MAX_DELIVER) {
        const delay = 2 ** m.info.deliveryCount * 1000;
        console.warn(`push ${event.type} ${event.data.orderId} failed, retry in ${delay}ms: ${String(err)}`);
        return m.nak(delay);
      }
      console.error(`push ${event.type} ${event.data.orderId} dropped: ${String(err)}`);
    }
  }
  await sql`insert into notifier.processed_events (event_id) values (${event.event_id}) on conflict do nothing`;
  m.ack();
}

const messages = await (await js.consumers.get(STREAM_NAME, DURABLE)).consume();
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void messages.close());
console.log(`notifier started (${enabled ? 'WebPush on' : 'VAPID keys missing: WebPush off'})`);
for await (const m of messages) {
  await handle(m).catch((err) => {
    console.error('handler crashed', err);
    m.nak(5000);
  });
}
await nc.drain();
await sql.end();
