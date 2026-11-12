// Consumes qa.requested (milestone submitted), runs the QA Gate on that commit, publishes qa.completed.
// Untrusted coder code only runs inside a throwaway Docker container (resource-capped, no capabilities);
// the checkout has no .git, so no GitHub token reaches it. Idempotent via qa_worker.processed_events.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AckPolicy, connect, type JsMsg } from 'nats';
import postgres from 'postgres';
import { QaRequestedEventSchema, STREAM_NAME, STREAM_SUBJECTS, SUBJECTS, type QaCompletedEvent } from '@grabcode/contracts/schemas';
import { checkout, githubAppFromEnv } from '@grabcode/repo-worker/checkout';
import { planSteps, scanSecrets, tail, verdict, type Check, type Status, type Step } from './gate';

const run = promisify(execFile);
const IMAGE = process.env.QA_IMAGE ?? 'node:22-alpine';
const STEP_TIMEOUT_MS = Number(process.env.QA_STEP_TIMEOUT_MS ?? 600_000);
const DURABLE = 'qa-worker';
const MAX_DELIVER = 4;

const gh = githubAppFromEnv();
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://grabcode:grabcode@127.0.0.1:5433/grabcode', { onnotice: () => {} });
await sql`create schema if not exists qa_worker`;
await sql`create table if not exists qa_worker.processed_events (
  event_id text primary key, processed_at timestamptz not null default now())`;

const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
const jsm = await nc.jetstreamManager();
await jsm.streams
  .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
  .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
await jsm.consumers
  .add(STREAM_NAME, {
    durable_name: DURABLE,
    ack_policy: AckPolicy.Explicit,
    filter_subject: SUBJECTS.QA_REQUESTED,
    max_deliver: MAX_DELIVER,
    ack_wait: 120_000_000_000, // 2 min; long gates keep the message with m.working()
  })
  .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subject: SUBJECTS.QA_REQUESTED }));
const js = nc.jetstream();

/** One step in a fresh container on the checkout. Non-zero exit = FAILED with the output tail. */
async function step(dir: string, corepack: string, s: Step): Promise<Check> {
  const name = `gc-qa-${randomUUID().slice(0, 8)}`;
  const args = ['run', '--rm', '--name', name, '--mount', `type=bind,src=${dir},dst=/w`, '-w', '/w', '-e', 'CI=true'];
  // pnpm is fetched by corepack in the (online) install step; offline steps reuse it from this per-gate cache.
  args.push('--mount', `type=bind,src=${corepack},dst=/corepack`, '-e', 'COREPACK_HOME=/corepack', '-e', 'COREPACK_DEFAULT_TO_LATEST=0');
  if (s.offline) args.push('--network', 'none');
  args.push('--memory', '2g', '--cpus', '2', '--pids-limit', '512', '--security-opt', 'no-new-privileges', IMAGE, 'sh', '-c', s.cmd);
  try {
    const { stdout, stderr } = await run('docker', args, { timeout: STEP_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 });
    return { name: s.name, status: 'PASSED', detail: tail(stdout + stderr, 400) };
  } catch (err: any) {
    // The CLI timing out does not stop the container.
    if (err.killed) await run('docker', ['rm', '-f', name]).catch(() => {});
    if (typeof err.code !== 'number' && !err.killed) throw err; // docker itself missing: gate ERROR, not a coder failure
    return { name: s.name, status: 'FAILED', detail: err.killed ? `timed out after ${STEP_TIMEOUT_MS / 1000}s` : tail(`${err.stdout ?? ''}${err.stderr ?? ''}`) };
  }
}

async function gate(repoFullName: string, sha: string | null): Promise<{ status: Status; checks: Check[] }> {
  const dir = await checkout(gh, repoFullName, sha);
  const corepack = await mkdtemp(join(tmpdir(), 'gc-corepack-'));
  try {
    const checks = [scanSecrets(dir)];
    const plan = planSteps(dir);
    if (plan) {
      let installed = true;
      for (const s of plan.steps) {
        if (!installed) checks.push({ name: s.name, status: 'SKIPPED', detail: 'install failed' });
        else {
          const c = await step(dir, corepack, s);
          checks.push(c);
          if (s.name === 'install' && c.status === 'FAILED') installed = false;
        }
      }
      checks.push(...plan.skipped);
    }
    return { status: verdict(checks, !!plan), checks };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    await rm(corepack, { recursive: true, force: true }).catch(() => {});
  }
}

async function handle(m: JsMsg) {
  const event = QaRequestedEventSchema.parse(m.json());
  const [seen] = await sql`select 1 from qa_worker.processed_events where event_id = ${event.event_id}`;
  if (seen) return m.ack();
  const d = event.data;
  const keepAlive = setInterval(() => m.working(), 30_000);
  let result: QaCompletedEvent['data']['result'];
  try {
    const r = await gate(d.repoFullName, d.commitHash);
    result = { status: r.status, commitHash: d.commitHash, checks: r.checks, finishedAt: new Date().toISOString() };
    console.log(`qa order=${d.orderId} ${d.milestoneId} ${result.status}`);
  } catch (err) {
    clearInterval(keepAlive);
    if (m.info.deliveryCount < MAX_DELIVER) {
      const delay = 2 ** m.info.deliveryCount * 1000;
      console.warn(`qa order=${d.orderId} attempt ${m.info.deliveryCount} failed, retry in ${delay}ms: ${String(err)}`);
      return m.nak(delay);
    }
    const msg = err instanceof Error ? err.message : String(err);
    result = { status: 'ERROR', commitHash: d.commitHash, checks: [{ name: 'gate', status: 'FAILED', detail: tail(msg) }], finishedAt: new Date().toISOString() };
    console.error(`qa order=${d.orderId} gate error: ${msg}`);
  }
  clearInterval(keepAlive);
  const out: QaCompletedEvent = {
    event_id: randomUUID(),
    type: SUBJECTS.QA_COMPLETED,
    occurred_at: new Date().toISOString(),
    data: { orderId: d.orderId, milestoneId: d.milestoneId, result },
  };
  await js.publish(SUBJECTS.QA_COMPLETED, JSON.stringify(out), { msgID: `${event.event_id}:result` });
  await sql`insert into qa_worker.processed_events (event_id) values (${event.event_id}) on conflict do nothing`;
  m.ack();
}

const messages = await (await js.consumers.get(STREAM_NAME, DURABLE)).consume();
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void messages.close());
console.log(`qa-worker started (image=${IMAGE}${gh || process.env.GIT_CLONE_BASE ? '' : ', GitHub App NOT configured: gates will ERROR'})`);
for await (const m of messages) {
  await handle(m).catch((err) => {
    console.error('handler crashed', err);
    m.nak(5000);
  });
}
await nc.drain();
await sql.end();
