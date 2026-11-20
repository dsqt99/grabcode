// Auth / briefs / repos API smoke test against a running local core-api (AUTH_DEV_LOGIN=true) + docker compose Postgres.
// Run: node api/core-api/scripts/smoke-auth.mjs
// Set WEBHOOK_SECRET to the core-api GITHUB_APP_WEBHOOK_SECRET to also test signed push delivery + dedupe. Also covers repo handover to a customer-named login.
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:4000';
const SECRET = process.env.WEBHOOK_SECRET;
const ok = (c, m) => {
  console.log(c ? 'OK  ' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};
const psql = (q) => execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'grabcode', '-tAc', q], { encoding: 'utf8' }).trim();

function client() {
  let cookie = '';
  return async (method, path, body, headers = {}) => {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: typeof body === 'string' ? body : body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const t = await r.text();
    return { status: r.status, body: t ? JSON.parse(t) : null, cookie };
  };
}

// --- auth: register / login / sessions ---
const email = `smoke-${Date.now().toString(36)}@example.test`;
const a = client();
ok((await a('POST', '/v1/auth/register', { email, password: 'short', name: 'S', role: 'CUSTOMER' })).status === 400, 'register weak password 400');
const reg = await a('POST', '/v1/auth/register', { email, password: 'smoke-pass-1', name: 'Smoke', role: 'CUSTOMER' });
ok(reg.status === 201 && reg.body.roles?.includes('CUSTOMER') && reg.cookie, 'register 201 + session cookie');
ok((await client()('POST', '/v1/auth/register', { email: email.toUpperCase(), password: 'smoke-pass-1', name: 'X', role: 'CODER' })).status === 409, 'duplicate email (any case) 409');
ok((await a('GET', '/v1/me')).status === 200, 'me 200 with session');
ok((await client()('GET', '/v1/me')).status === 401, 'me 401 without session');

const wrongPw = await client()('POST', '/v1/auth/login', { email, password: 'nope-nope' });
const noUser = await client()('POST', '/v1/auth/login', { email: `x${email}`, password: 'nope-nope' });
ok(wrongPw.status === 401 && noUser.status === 401 && wrongPw.body.message === noUser.body.message, 'wrong password / unknown email: same 401');
const b = client();
ok((await b('POST', '/v1/auth/login', { email, password: 'smoke-pass-1' })).status === 200, 'login 200');

// Password change keeps the caller's session and ends the others.
ok((await b('POST', '/v1/me/password', { currentPassword: 'bad', newPassword: 'smoke-pass-2' })).status >= 400, 'change password with wrong current rejected');
ok((await b('POST', '/v1/me/password', { currentPassword: 'smoke-pass-1', newPassword: 'smoke-pass-2' })).status < 300, 'change password ok');
ok((await b('GET', '/v1/me')).status === 200 && (await a('GET', '/v1/me')).status === 401, 'own session kept, other session revoked');
ok((await client()('POST', '/v1/auth/login', { email, password: 'smoke-pass-2' })).status === 200, 'login with new password');

// Expired session = logged out; logout clears the session row.
const uid = (await b('GET', '/v1/me')).body.id;
psql(`update core.sessions set expires_at = now() - interval '1 second' where user_id = '${uid}'`);
ok((await b('GET', '/v1/me')).status === 401, 'expired session 401');
const c = client();
await c('POST', '/v1/auth/login', { email, password: 'smoke-pass-2' });
ok((await c('POST', '/v1/auth/logout')).status < 300 && (await c('GET', '/v1/me')).status === 401, 'logout ends session');

// Lockout: 10 failures per email -> 429 even with the right password (counter in core.rate_limits, shared by replicas).
const lockEmail = `x${email}`;
await client()('POST', '/v1/auth/register', { email: lockEmail, password: 'smoke-pass-1', name: 'Lock', role: 'CUSTOMER' });
for (let i = 0; i < 10; i++) await client()('POST', '/v1/auth/login', { email: lockEmail, password: 'nope-nope' });
ok((await client()('POST', '/v1/auth/login', { email: lockEmail, password: 'smoke-pass-1' })).status === 429, 'login locked after 10 failures 429');
// The smoke itself sends from one IP: clear its login/brief IP counters so reruns stay under the caps.
psql(`delete from core.rate_limits where key like 'login-ip:%' or key like 'brief-ip:%'`);

// --- briefs ---
const anon = client();
ok((await anon('POST', '/v1/briefs', { prompt: '', tier: 'EXPRESS' })).status === 400, 'brief empty prompt 400');
const job = await anon('POST', '/v1/briefs', { prompt: 'smoke landing page', tier: 'EXPRESS' });
ok(job.status === 202 && job.body.status === 'PENDING', 'brief 202 PENDING');
ok((await anon('GET', `/v1/briefs/${job.body.id}`)).body?.id === job.body.id, 'brief GET by id');
ok((await anon('GET', '/v1/briefs/not-a-uuid')).status === 404 && (await anon('GET', `/v1/briefs/${randomUUID()}`)).status === 404, 'brief unknown / bad id 404');
ok(psql(`select count(*) from core.outbox where subject = 'brief.requested' and payload->'data'->>'jobId' = '${job.body.id}'`) === '1', 'brief.requested outbox row');
psql(`update core.rate_limits set n = 20 where key like 'brief-ip:%'`);
ok((await anon('POST', '/v1/briefs', { prompt: 'smoke over cap', tier: 'EXPRESS' })).status === 429, 'brief over 20/hour per IP 429');
psql(`delete from core.rate_limits where key like 'brief-ip:%'`);

// --- repos ---
ok((await anon('POST', '/v1/repos', { orderId: 'GC-1' })).status === 401, 'repo request without session 401');
const cust = client();
await cust('POST', '/v1/auth/dev-login', { login: 'smoke-repo-cust', role: 'CUSTOMER' });
const stranger = client();
await stranger('POST', '/v1/auth/dev-login', { login: 'smoke-repo-other', role: 'CODER' });
const brief = { title: 'repo smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones: [{ id: 'M1', title: 'm', description: '', weightPercent: 100, status: 'PENDING' }] };
const order = (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief, phone: '0912345678', acceptTerms: true })).body;
ok((await stranger('POST', '/v1/repos', { orderId: order.id })).status >= 400, 'repo request by non-coder of order rejected');
ok((await stranger('GET', `/v1/repos/${order.id}`)).status === 404 && (await cust('GET', "/v1/repos/GC-1'")).status === 404, 'repo GET by non-party / bad id 404');

const push = (raw, sig) => fetch(`${API}/v1/github/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-event': 'push', 'x-hub-signature-256': sig }, body: raw });
const full = `grabcode-sandbox/smoke-${Date.now().toString(36)}`;
const sha = randomUUID().replaceAll('-', '') + '00000000';
const raw = JSON.stringify({ repository: { full_name: full }, commits: [{ id: sha, message: 'init', author: { username: 'smoke' }, url: 'https://example.test', timestamp: new Date().toISOString() }] });
ok((await push(raw, 'sha256=' + '0'.repeat(64))).status === 401, 'webhook bad signature 401');
ok((await push(raw, undefined)).status === 401, 'webhook missing signature 401');
const coderId = psql(`select id from core.users where github_login = 'smoke-repo-other' limit 1`) || uid;
psql(`insert into core.order_repos (order_id, coder_user_id, status, repo_full_name) values ('${order.id}', '${coderId}', 'READY', '${full}')`);
if (SECRET) {
  const sig = `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
  const [r1, r2] = [await push(raw, sig), await push(raw, sig)];
  ok(r1.status === 204 && r2.status === 204, 'signed push 204 (twice)');
  ok(psql(`select count(*) from core.repo_commits where sha = '${sha}'`) === '1', 'redelivered push stored once');
  ok((await cust('GET', `/v1/repos/${order.id}`)).body?.commits?.some((x) => x.sha === sha), 'customer sees pushed commit');
} else console.log('SKIP signed push (set WEBHOOK_SECRET)');
// Handover to a customer-named GitHub login (account without one), only after ACCEPTED.
const handover = (k, login) => k('POST', `/v1/repos/${order.id}/handover`, { githubLogin: login });
ok((await handover(cust, 'octocat')).status === 409, 'handover before ACCEPTED 409');
psql(`update core.orders set status = 'ACCEPTED' where id = '${order.id}'`);
ok((await handover(cust, '-bad-')).status === 400 && (await handover(stranger, 'octocat')).status === 404, 'handover bad login 400, non-customer 404');
const h = await handover(cust, 'octocat');
ok(h.status === 202 && psql(`select payload->'data'->>'customerGithubLogin' from core.outbox where subject = 'repo.handover.requested' and payload->'data'->>'orderId' = '${order.id}'`) === 'octocat', 'handover 202 + outbox event with named login');
psql(`update core.order_repos set handed_over_at = now(), handed_over_to = 'octocat' where order_id = '${order.id}'`);
ok((await handover(cust, 'someone')).status === 409, 'handover again after done 409');
psql(`update core.orders set status = 'CANCELLED' where id = '${order.id}'`);
