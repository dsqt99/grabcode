// S5 smoke: QA gate per milestone + sandbox request, against running core-api (AUTH_DEV_LOGIN=true), outbox-relay,
// qa-worker and deploy-worker, both started with GIT_CLONE_BASE=file:///<REPOS> (local bare repos, no GitHub).
// Run: REPOS=<dir> node api/core-api/scripts/smoke-qa.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:4000';
const REPOS = process.env.REPOS;
if (!REPOS) throw new Error('set REPOS (same dir as GIT_CLONE_BASE of the workers)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => {
  console.log(c ? 'OK  ' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};
const psql = (q) => execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'grabcode', '-tAc', q], { encoding: 'utf8' }).trim();

async function client(login, role) {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const t = await r.text();
    return { status: r.status, body: t ? JSON.parse(t) : null };
  };
  await call('POST', '/v1/auth/dev-login', { login, role });
  return call;
}

const run = Date.now().toString(36);
const repoFullName = `grabcode-sandbox/smoke-qa-${run}`;
const bare = join(REPOS, `${repoFullName}.git`);
mkdirSync(bare, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'gc-smoke-'));
const git = (...a) => execFileSync('git', a, { cwd: work, encoding: 'utf8' }).trim();
execFileSync('git', ['init', '--bare', '-q', bare]);
git('init', '-q', '-b', 'main');
git('config', 'user.email', 'smoke@grabcode.local');
git('config', 'user.name', 'smoke');
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'smoke', version: '1.0.0', scripts: { test: 'node -e "process.exit(1+1===2?0:1)"' } }));
writeFileSync(join(work, '.env'), 'DB_PASSWORD=hunter2\n');
git('add', '-A');
git('commit', '-qm', 'M1 with leaked env');
const bad = git('rev-parse', 'HEAD');
git('rm', '-q', '.env');
git('commit', '-qm', 'M1 fixed');
const good = git('rev-parse', 'HEAD');
git('push', '-q', bare, 'main');
rmSync(work, { recursive: true, force: true });

const cust = await client('s5cust', 'CUSTOMER');
const coder = await client(`s5k-${run}`, 'CODER');
const coderId = (await coder('GET', '/v1/me')).body.id;
await coder('PUT', '/v1/me/presence', { online: true });
const brief = { title: 'S5 smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones: [{ id: 'M1', title: 'm1', description: '', weightPercent: 100, status: 'PENDING' }] };
const o = (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief })).body;
await cust('POST', '/v1/payments/dev-deposit', { orderId: o.id });
for (let i = 0, done = false; !done; i++) {
  if (i > 40) throw new Error(`no offer for ${o.id}`);
  const { offers } = (await coder('GET', '/v1/me/offers')).body;
  for (const x of offers) {
    await coder('POST', `/v1/offers/${x.id}/${x.orderId === o.id ? 'accept' : 'decline'}`);
    done ||= x.orderId === o.id;
  }
  if (!done) await sleep(1000);
}
psql(`insert into core.order_repos (order_id, coder_user_id, status, repo_full_name, collaborator) values ('${o.id}', '${coderId}', 'READY', '${repoFullName}', 's5k')`);
psql(`insert into core.repo_commits values ('${bad}', '${o.id}', 'leak', 'k', 'https://x', now() - interval '1 minute'), ('${good}', '${o.id}', 'fix', 'k', 'https://x', now())`);

const ms = `/v1/orders/${o.id}/milestones/M1`;
async function qaOf(sha) {
  for (let i = 0; i < 150; i++) {
    const qa = (await cust('GET', `/v1/orders/${o.id}`)).body.brief.milestones[0].qa;
    if (qa?.commitHash === sha && qa.status !== 'RUNNING') return qa;
    await sleep(2000);
  }
  return null;
}
const s1 = await coder('POST', `${ms}/submit`, { commitHash: bad.slice(0, 7) });
ok(s1.body.brief.milestones[0].qa?.status === 'RUNNING', 'submit -> qa RUNNING');
const q1 = await qaOf(bad);
ok(q1?.status === 'FAILED' && q1.checks.find((c) => c.name === 'secrets')?.status === 'FAILED', `leaked .env -> ${q1?.status}`);
await cust('POST', `${ms}/reject`, { note: 'QA fail' });
await coder('POST', `${ms}/submit`, { commitHash: good.slice(0, 7) });
const q2 = await qaOf(good);
ok(q2?.status === 'PASSED', `fixed commit -> ${q2?.status}: ${q2?.checks.map((c) => `${c.name}=${c.status}`).join(' ')}`);

await cust('POST', `${ms}/approve`);
const dl = await coder('POST', `/v1/orders/${o.id}/transitions`, { status: 'DELIVERED' });
ok(dl.body.sandbox?.status === 'PENDING', 'DELIVERED -> sandbox PENDING');
let sb;
for (let i = 0; i < 30 && (!sb || sb.status === 'PENDING'); i++) {
  await sleep(1000);
  sb = (await cust('GET', `/v1/orders/${o.id}`)).body.sandbox;
}
ok(sb && sb.status !== 'PENDING', `deploy-worker answered: ${sb?.status} ${sb?.url ?? sb?.error ?? ''}`);
