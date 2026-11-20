// Consumes repo.requested, provisions the order's private repo through the GitHub App, publishes repo.provisioned / repo.failed.
// Also consumes repo.handover.requested (order ACCEPTED): customer gets admin, coder drops to read, publishes repo.handed_over.
// Every step is idempotent (create-or-get, skip existing CLAUDE.md, PUT protection/collaborator), so a redelivery resumes safely.
// Idempotent via repo_worker.processed_events; retryable failures are NAKed with exponential backoff.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AckPolicy, connect, type JsMsg } from 'nats';
import postgres from 'postgres';
import {
  RepoHandoverRequestedEventSchema,
  RepoRequestedEventSchema,
  STREAM_NAME,
  STREAM_SUBJECTS,
  SUBJECTS,
  type RepoFailedEvent,
  type RepoHandedOverEvent,
  type RepoHandoverRequestedEvent,
  type RepoProvisionedEvent,
  type RepoRequestedEvent,
} from '@grabcode/contracts/schemas';
import { createGitHubApp, expect, GitHubError } from './github';
import { BRAND } from '@grabcode/contracts';

const ORG = process.env.GITHUB_ORG ?? 'grabcode-sandbox';
const APP_ID = process.env.GITHUB_APP_ID ?? '';
const INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID ?? '';
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY_PATH
  ? readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8')
  : (process.env.GITHUB_APP_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
const DURABLE = 'repo-worker';
const MAX_DELIVER = 6;

const gh = APP_ID && INSTALLATION_ID && PRIVATE_KEY ? createGitHubApp({ appId: APP_ID, installationId: INSTALLATION_ID, privateKey: PRIVATE_KEY }) : null;

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://grabcode:grabcode@127.0.0.1:5433/grabcode', {
  onnotice: () => {}, // "already exists, skipping" from the idempotent DDL below
});
await sql`create schema if not exists repo_worker`;
await sql`create table if not exists repo_worker.processed_events (
  event_id text primary key, processed_at timestamptz not null default now())`;

const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
const jsm = await nc.jetstreamManager();
// add is a no-op for an identical config; update picks up subjects added to the contract later.
await jsm.streams
  .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
  .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
const filter_subjects = [SUBJECTS.REPO_REQUESTED, SUBJECTS.REPO_HANDOVER_REQUESTED];
// add rejects a changed config on an existing durable; update widens its filter in place.
await jsm.consumers
  .add(STREAM_NAME, {
    durable_name: DURABLE,
    ack_policy: AckPolicy.Explicit,
    filter_subjects,
    max_deliver: MAX_DELIVER,
    ack_wait: 120_000_000_000, // 2 min in ns: 4 GitHub calls at 30 s timeout each fit inside
  })
  .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subject: '', filter_subjects }));
const js = nc.jetstream();

async function provision(d: RepoRequestedEvent['data']): Promise<RepoProvisionedEvent['data']> {
  if (!gh) throw new GitHubError(0, 'GitHub App not configured (GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / private key)', false);

  // 1. Private repo with an initial commit; 422 = name taken, i.e. our own earlier attempt.
  const created = await gh('POST', `/orgs/${ORG}/repos`, {
    name: d.repoName,
    private: true,
    description: `${BRAND.name} ${d.orderId}: ${d.title}`.slice(0, 350),
    auto_init: true,
    has_wiki: false,
  });
  const repo = created.status === 422 ? expect(await gh('GET', `/repos/${ORG}/${d.repoName}`), [200], 'get repo') : expect(created, [201], 'create repo');
  const full: string = repo.full_name;
  const branch: string = repo.default_branch;

  // 2. CLAUDE.md, only if missing (a redelivery must not create a second commit).
  const existing = await gh('GET', `/repos/${full}/contents/CLAUDE.md`);
  if (existing.status === 404) {
    expect(
      await gh('PUT', `/repos/${full}/contents/CLAUDE.md`, {
        message: `chore: add CLAUDE.md for ${d.orderId}`,
        content: Buffer.from(d.claudeMd, 'utf8').toString('base64'),
        branch,
      }),
      [201],
      'commit CLAUDE.md',
    );
  } else expect(existing, [200], 'read CLAUDE.md');

  // 3. No force-push / branch deletion, so milestone SHAs stay reachable.
  // Private repos need a paid org plan for protection: best-effort, warn and go on.
  const prot = await gh('PUT', `/repos/${full}/branches/${branch}/protection`, {
    required_status_checks: null,
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  });
  if (prot.status !== 200) console.warn(`order=${d.orderId} branch protection skipped (${prot.status}): ${prot.json?.message}`);

  // 4. Coder gets push access (201 = invitation sent, 204 = already a collaborator).
  let collaborator: string | null = null;
  if (d.coderGithubLogin) {
    const inv = await gh('PUT', `/repos/${full}/collaborators/${d.coderGithubLogin}`, { permission: 'push' });
    if (inv.status === 404 || inv.status === 422) console.warn(`order=${d.orderId} collaborator ${d.coderGithubLogin} rejected (${inv.status})`);
    else collaborator = (expect(inv, [201, 204], 'add collaborator'), d.coderGithubLogin);
  }

  return { orderId: d.orderId, repoFullName: full, htmlUrl: repo.html_url, cloneUrl: repo.clone_url, defaultBranch: branch, collaborator };
}

/** PUT collaborator is create-or-update, so a redelivery just re-applies the same permissions. */
async function handover(d: RepoHandoverRequestedEvent['data']): Promise<RepoHandedOverEvent['data']> {
  if (!gh) throw new GitHubError(0, 'GitHub App not configured (GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / private key)', false);
  let to: string | null = null;
  if (d.customerGithubLogin) {
    const inv = await gh('PUT', `/repos/${d.repoFullName}/collaborators/${d.customerGithubLogin}`, { permission: 'admin' });
    if (inv.status === 404 || inv.status === 422) console.warn(`order=${d.orderId} customer ${d.customerGithubLogin} rejected (${inv.status}), customer can name another login`);
    else to = (expect(inv, [201, 204], 'invite customer'), d.customerGithubLogin);
  } else console.warn(`order=${d.orderId} customer has no GitHub login: repo stays in ${ORG} until the customer names one (POST /v1/repos/:orderId/handover)`);
  if (d.coderGithubLogin) expect(await gh('PUT', `/repos/${d.repoFullName}/collaborators/${d.coderGithubLogin}`, { permission: 'pull' }), [201, 204], 'downgrade coder');
  return { orderId: d.orderId, customerGithubLogin: to };
}

// Unknown errors (network, timeout, DB/NATS) retry; GitHubError carries its own verdict.
const isRetryable = (err: unknown) => !(err instanceof GitHubError) || err.retryable;

async function publish(subject: string, event: RepoProvisionedEvent | RepoFailedEvent | RepoHandedOverEvent, msgID: string) {
  await js.publish(subject, JSON.stringify(event), { msgID });
}

async function handleHandover(m: JsMsg) {
  const event = RepoHandoverRequestedEventSchema.parse(m.json());
  const [seen] = await sql`select 1 from repo_worker.processed_events where event_id = ${event.event_id}`;
  if (seen) return m.ack();
  const { orderId } = event.data;
  try {
    const data = await handover(event.data);
    await publish(
      SUBJECTS.REPO_HANDED_OVER,
      { event_id: randomUUID(), type: SUBJECTS.REPO_HANDED_OVER, occurred_at: new Date().toISOString(), data },
      `${event.event_id}:result`,
    );
    console.log(`repo handed over order=${orderId} to=${data.customerGithubLogin}`);
  } catch (err) {
    if (isRetryable(err) && m.info.deliveryCount < MAX_DELIVER) {
      const delay = 2 ** m.info.deliveryCount * 1000;
      console.warn(`handover order=${orderId} attempt ${m.info.deliveryCount} failed, retry in ${delay}ms: ${String(err)}`);
      return m.nak(delay);
    }
    // No failure event in the contract: order_repos.handed_over_at stays null, ops re-run it from the admin side.
    console.error(`handover order=${orderId} failed permanently: ${String(err)}`);
  }
  await sql`insert into repo_worker.processed_events (event_id) values (${event.event_id}) on conflict do nothing`;
  m.ack();
}

async function handle(m: JsMsg) {
  if (m.subject === SUBJECTS.REPO_HANDOVER_REQUESTED) return handleHandover(m);
  const event = RepoRequestedEventSchema.parse(m.json());
  const [seen] = await sql`select 1 from repo_worker.processed_events where event_id = ${event.event_id}`;
  if (seen) return m.ack();

  const { orderId } = event.data;
  try {
    const data = await provision(event.data);
    await publish(
      SUBJECTS.REPO_PROVISIONED,
      { event_id: randomUUID(), type: SUBJECTS.REPO_PROVISIONED, occurred_at: new Date().toISOString(), data },
      `${event.event_id}:result`, // stable id: a crash-and-redeliver publishes a JetStream-deduped copy
    );
    console.log(`repo ready order=${orderId} ${data.htmlUrl}`);
  } catch (err) {
    const retryable = isRetryable(err);
    if (retryable && m.info.deliveryCount < MAX_DELIVER) {
      const delay = 2 ** m.info.deliveryCount * 1000;
      console.warn(`order=${orderId} attempt ${m.info.deliveryCount} failed, retry in ${delay}ms: ${String(err)}`);
      return m.nak(delay);
    }
    console.error(`order=${orderId} failed permanently: ${String(err)}`);
    await publish(
      SUBJECTS.REPO_FAILED,
      {
        event_id: randomUUID(),
        type: SUBJECTS.REPO_FAILED,
        occurred_at: new Date().toISOString(),
        data: { orderId, error: err instanceof Error ? err.message : String(err), retryable },
      },
      `${event.event_id}:result`,
    );
  }
  await sql`insert into repo_worker.processed_events (event_id) values (${event.event_id}) on conflict do nothing`;
  m.ack();
}

const messages = await (await js.consumers.get(STREAM_NAME, DURABLE)).consume();
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void messages.close());
console.log(`repo-worker started (org=${ORG}${gh ? '' : ', GitHub App NOT configured: jobs will fail'})`);
for await (const m of messages) {
  await handle(m).catch((err) => {
    console.error('handler crashed', err);
    m.nak(5000);
  });
}
await nc.drain();
await sql.end();
