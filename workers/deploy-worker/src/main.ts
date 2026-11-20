// Consumes deploy.requested (order DELIVERED), builds the commit on Cloud Run (`gcloud run deploy --source`,
// buildpacks or the repo's Dockerfile), publishes deploy.ready / deploy.failed. A cleanup tick deletes previews
// older than SANDBOX_TTL_HOURS and publishes deploy.expired. Needs gcloud on PATH, authenticated, and GCP_PROJECT.
// Idempotent via deploy_worker.processed_events; a redeploy of the same order replaces its service in place.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { AckPolicy, connect, type JsMsg } from 'nats';
import postgres from 'postgres';
import {
  DeployRequestedEventSchema,
  STREAM_NAME,
  STREAM_SUBJECTS,
  SUBJECTS,
  type DeployExpiredEvent,
  type DeployFailedEvent,
  type DeployReadyEvent,
} from '@grabcode/contracts/schemas';
import { checkout, githubAppFromEnv } from '@grabcode/repo-worker/checkout';
import { serviceName } from './service';

const exec = promisify(execFile);
const PROJECT = process.env.GCP_PROJECT ?? '';
const REGION = process.env.GCP_REGION ?? 'asia-southeast1';
/** Runtime identity of sandboxes: a service account with NO roles. Coder code runs there; the default compute SA is often Editor. */
const SANDBOX_SA = process.env.SANDBOX_SERVICE_ACCOUNT ?? '';
const TTL_HOURS = Number(process.env.SANDBOX_TTL_HOURS ?? 72);
const DURABLE = 'deploy-worker';
const MAX_DELIVER = 4;

const gh = githubAppFromEnv();
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://grabcode:grabcode@127.0.0.1:5433/grabcode', { onnotice: () => {} });
await sql`create schema if not exists deploy_worker`;
await sql`create table if not exists deploy_worker.processed_events (
  event_id text primary key, processed_at timestamptz not null default now())`;
await sql`create table if not exists deploy_worker.sandboxes (
  order_id text primary key, service text not null, expires_at timestamptz not null)`;

const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
const jsm = await nc.jetstreamManager();
await jsm.streams
  .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
  .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
await jsm.consumers
  .add(STREAM_NAME, {
    durable_name: DURABLE,
    ack_policy: AckPolicy.Explicit,
    filter_subject: SUBJECTS.DEPLOY_REQUESTED,
    max_deliver: MAX_DELIVER,
    ack_wait: 120_000_000_000, // 2 min; Cloud Build keeps the message with m.working()
  })
  .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subject: SUBJECTS.DEPLOY_REQUESTED }));
const js = nc.jetstream();

/** Not worth a retry: config missing on this host. */
class ConfigError extends Error {}

// gcloud is a .cmd on Windows, which Node only spawns through a shell (args here never contain spaces).
const gcloud = (args: string[]) =>
  exec('gcloud', [...args, '--project', PROJECT, '--region', REGION, '--quiet'], { timeout: 1_200_000, maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' });

async function deploy(orderId: string, repoFullName: string, sha: string | null) {
  if (!PROJECT) throw new ConfigError('GCP not configured (GCP_PROJECT, gcloud auth)');
  if (!SANDBOX_SA) throw new ConfigError('SANDBOX_SERVICE_ACCOUNT not set (a service account with no roles for coder code)');
  const dir = await checkout(gh, repoFullName, sha);
  try {
    const service = serviceName(orderId);
    const { stdout } = await gcloud(['run', 'deploy', service, '--source', dir, '--service-account', SANDBOX_SA, '--allow-unauthenticated', '--max-instances', '1', '--labels', 'grabcode=sandbox', '--format', 'value(status.url)']).catch((err) => {
      if (err.code === 'ENOENT' || /not recognized|not found/i.test(String(err.stderr))) throw new ConfigError('gcloud CLI not installed on the deploy-worker host');
      throw new Error(String(err.stderr || err.message).trim().slice(-1500));
    });
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000).toISOString();
    await sql`insert into deploy_worker.sandboxes values (${orderId}, ${service}, ${expiresAt})
      on conflict (order_id) do update set service = excluded.service, expires_at = excluded.expires_at`;
    return { url: stdout.trim(), expiresAt };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function publish(event: DeployReadyEvent | DeployFailedEvent | DeployExpiredEvent, msgID: string) {
  await js.publish(event.type, JSON.stringify(event), { msgID });
}

async function handle(m: JsMsg) {
  const event = DeployRequestedEventSchema.parse(m.json());
  const [seen] = await sql`select 1 from deploy_worker.processed_events where event_id = ${event.event_id}`;
  if (seen) return m.ack();
  const { orderId, repoFullName, commitHash } = event.data;
  const keepAlive = setInterval(() => m.working(), 30_000);
  const base = { event_id: randomUUID(), occurred_at: new Date().toISOString() };
  try {
    const { url, expiresAt } = await deploy(orderId, repoFullName, commitHash);
    await publish({ ...base, type: SUBJECTS.DEPLOY_READY, data: { orderId, url, expiresAt } }, `${event.event_id}:result`);
    console.log(`sandbox ready order=${orderId} ${url}`);
  } catch (err) {
    clearInterval(keepAlive);
    if (!(err instanceof ConfigError) && m.info.deliveryCount < MAX_DELIVER) {
      const delay = 2 ** m.info.deliveryCount * 1000;
      console.warn(`deploy order=${orderId} attempt ${m.info.deliveryCount} failed, retry in ${delay}ms: ${String(err)}`);
      return m.nak(delay);
    }
    const error = err instanceof Error ? err.message : String(err);
    console.error(`deploy order=${orderId} failed: ${error}`);
    await publish({ ...base, type: SUBJECTS.DEPLOY_FAILED, data: { orderId, error } }, `${event.event_id}:result`);
  }
  clearInterval(keepAlive);
  await sql`insert into deploy_worker.processed_events (event_id) values (${event.event_id}) on conflict do nothing`;
  m.ack();
}

/** Deletes expired previews; a failed delete stays in the table and is retried next tick. */
async function cleanup() {
  const expired = await sql<{ order_id: string; service: string; expires_at: Date }[]>`
    select * from deploy_worker.sandboxes where expires_at < now()`;
  for (const s of expired) {
    try {
      await gcloud(['run', 'services', 'delete', s.service]).catch((err) => {
        if (!/could not be found|NOT_FOUND/i.test(String(err.stderr))) throw err; // already gone = done
      });
      await publish(
        { event_id: randomUUID(), occurred_at: new Date().toISOString(), type: SUBJECTS.DEPLOY_EXPIRED, data: { orderId: s.order_id } },
        `expire:${s.order_id}:${s.expires_at.toISOString()}`,
      );
      await sql`delete from deploy_worker.sandboxes where order_id = ${s.order_id} and expires_at = ${s.expires_at}`;
      console.log(`sandbox expired order=${s.order_id} deleted ${s.service}`);
    } catch (err) {
      console.warn(`cleanup ${s.service} failed, retry next tick: ${String(err)}`);
    }
  }
}
const tick = setInterval(() => void cleanup().catch((e) => console.error('cleanup crashed', e)), 10 * 60_000);
void cleanup().catch((e) => console.error('cleanup crashed', e));

const messages = await (await js.consumers.get(STREAM_NAME, DURABLE)).consume();
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    clearInterval(tick);
    void messages.close();
  });
console.log(`deploy-worker started (${PROJECT ? `project=${PROJECT} region=${REGION}` : 'GCP NOT configured: deploys will fail'}, ttl=${TTL_HOURS}h)`);
for await (const m of messages) {
  await handle(m).catch((err) => {
    console.error('handler crashed', err);
    m.nak(5000);
  });
}
await nc.drain();
await sql.end();
