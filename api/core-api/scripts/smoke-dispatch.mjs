// S3 dispatch smoke test against a running local core-api (AUTH_DEV_LOGIN=true) + docker compose Postgres.
// Run: node api/core-api/scripts/smoke-dispatch.mjs
import { execFileSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:4000';
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

/** Polls a coder's offers (heartbeat), declining offers for other orders, until one for `orderId` shows up. */
async function offerFor(coder, orderId, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const { offers } = (await coder('GET', '/v1/me/offers')).body;
    const mine = offers.find((o) => o.orderId === orderId);
    if (mine) return mine;
    for (const o of offers) await coder('POST', `/v1/offers/${o.id}/decline`);
    await sleep(1000);
  }
  return null;
}

const cust = await client('s3cust', 'CUSTOMER');
const [a, b, c] = await Promise.all(['s3a', 's3b', 's3c'].map((l) => client(l, 'CODER')));
await a('PUT', '/v1/me/presence', { online: true });
await b('PUT', '/v1/me/presence', { online: true });
await c('PUT', '/v1/me/presence', { online: false });
ok((await a('GET', '/v1/me/presence')).body.online === true, 'presence stored server side');
ok((await cust('PUT', '/v1/me/presence', { online: true })).status === 403, 'customer cannot go online 403');

const brief = { title: 'S3 smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones: [{ id: 'M1', title: 'm', description: '', weightPercent: 100, status: 'PENDING' }] };
const newOrder = async () => {
  const o = (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief })).body;
  await cust('POST', '/v1/payments/dev-deposit', { orderId: o.id });
  return o;
};

// Race: two coders accept the same order at once -> exactly one wins.
const o1 = await newOrder();
const [oa, ob] = await Promise.all([offerFor(a, o1.id), offerFor(b, o1.id)]);
ok(oa && ob && oa.wave === ob.wave, `${o1.id} offered to a + b in wave ${oa?.wave}`);
ok(!(await c('GET', '/v1/me/offers')).body.offers.length, 'offline coder gets no offer');
ok((await cust('GET', `/v1/orders/${o1.id}`)).body.status === 'DISPATCHED', 'order DISPATCHED after first wave');
ok((await a('POST', `/v1/orders/${o1.id}/transitions`, { status: 'IN_PROGRESS' })).status === 404, 'old claim endpoint gone (404 before offer accept)');
const res = await Promise.all([a('POST', `/v1/offers/${oa.id}/accept`), b('POST', `/v1/offers/${ob.id}/accept`)]);
const codes = res.map((r) => r.status).sort();
ok(codes[0] === 200 && codes[1] === 409, `concurrent accept -> ${codes.join(',')}`);
const winner = res[0].status === 200 ? 'a' : 'b';
const order1 = (await cust('GET', `/v1/orders/${o1.id}`)).body;
ok(order1.status === 'IN_PROGRESS' && order1.coder?.name, `${o1.id} IN_PROGRESS, coder ${order1.coder?.name}`);
ok(psql(`select string_agg(status, ',' order by status) from core.dispatch_offers where order_id = '${o1.id}'`) === 'ACCEPTED,LOST', 'offers ACCEPTED + LOST');

// Next order: the winner is busy; the other declines -> nobody left; c comes online -> wave 2; expiry -> wave 3 re-asks c.
const free = winner === 'a' ? b : a;
const o2 = await newOrder();
const of = await offerFor(free, o2.id);
ok(of && psql(`select count(*) from core.dispatch_offers where order_id = '${o2.id}'`) === '1', 'busy winner skipped, wave 1 = free coder only');
ok((await free('POST', `/v1/offers/${of.id}/decline`)).status === 204, 'decline 204');
await c('PUT', '/v1/me/presence', { online: true });
const oc = await offerFor(c, o2.id);
ok(oc?.wave === 2, `after decline -> wave 2 to c (${oc?.wave})`);
psql(`update core.dispatch_offers set expires_at = now() where id = '${oc.id}'`);
ok((await c('POST', `/v1/offers/${oc.id}/accept`)).status === 409, 'expired offer accept 409');
const oc3 = await offerFor(c, o2.id);
ok(oc3?.wave === 3 && psql(`select status from core.dispatch_offers where id = '${oc.id}'`) === 'EXPIRED', `expired -> wave 3 re-asks c, never the decliner`);
ok(!(await free('GET', '/v1/me/offers')).body.offers.some((o) => o.orderId === o2.id), 'decliner not asked again');
ok((await c('POST', `/v1/offers/${oc3.id}/accept`)).status === 200, 'c accepts wave 3');
ok(Number(psql(`select count(*) from core.outbox where subject like 'dispatch.%' and payload->'data'->>'orderId' = '${o2.id}'`)) >= 4, 'dispatch.* outbox events written');

for (const k of [a, b, c]) await k('PUT', '/v1/me/presence', { online: false });
