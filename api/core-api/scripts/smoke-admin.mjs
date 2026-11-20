// S7 admin smoke against a running local core-api (AUTH_DEV_LOGIN=true) + docker compose Postgres.
// Covers coder tier/suspend, dispute split, DRAFT refund, suspense reconciliation, coder payouts, monitor, repo retry.
// Run: node api/core-api/scripts/smoke-admin.mjs
import { execFileSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:4000';
const ok = (c, m) => {
  console.log(c ? 'OK  ' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};
const psql = (q) => execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'grabcode', '-tAc', q], { encoding: 'utf8' }).trim();
const balance = (acct) => Number(psql(`select coalesce(sum(amount_vnd),0) from core.ledger_entries where account = '${acct}'`));

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

const brief = { title: 'S7 smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '# smoke', milestones: [{ id: 'M1', title: 'm1', description: '', weightPercent: 100, status: 'PENDING' }] };
const newOrder = async (cust) => (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief, phone: '0912345678', acceptTerms: true })).body;
/** Bank transfer as the SePay webhook would book it; orderId null = unmatched (suspense). */
const deposit = (id, orderId, amount, content) =>
  psql(
    `with t as (insert into core.ledger_txs (id, kind, order_id, meta) values ('${id}', 'DEPOSIT', ${orderId ? `'${orderId}'` : 'null'}, '{"content":"${content}"}') returning id) ` +
      `insert into core.ledger_entries (tx_id, account, amount_vnd) select id, a, v from t, (values ('bank:sepay', ${-amount}), ('${orderId ? `escrow:${orderId}` : 'suspense'}', ${amount})) x(a, v)`,
  );

const run = Date.now().toString(36);
const admin = await client(`s7a-${run}`, 'ADMIN');
const cust = await client(`s7c-${run}`, 'CUSTOMER');
const coder = await client(`s7k-${run}`, 'CODER');
const coderId = (await coder('GET', '/v1/me')).body.id;

// ---- gate ----
ok((await cust('GET', '/v1/admin/coders')).status === 403, 'customer -> admin route 403');
ok((await fetch(`${API}/v1/admin/monitor`)).status === 401, 'anonymous -> 401');

// ---- coders: suspend / tier override ----
await coder('PUT', '/v1/me/presence', { online: true });
const list = (await admin('GET', '/v1/admin/coders')).body.coders;
ok(list.some((c) => c.id === coderId && c.online && !c.suspended), 'coder listed, online');
const sus = await admin('PATCH', `/v1/admin/coders/${coderId}`, { suspended: true });
ok(sus.status === 200 && sus.body.suspended && !sus.body.online, 'suspend -> offline');
ok((await coder('GET', '/v1/me')).status === 401, 'suspend -> signed out');
ok((await admin('PATCH', `/v1/admin/coders/${coderId}`, {})).status === 400, 'empty patch 400');
const gold = await admin('PATCH', `/v1/admin/coders/${coderId}`, { tierOverride: 'GOLD', suspended: false });
ok(gold.body.tier === 'GOLD' && !gold.body.suspended, 'tier override GOLD, unsuspended');
await coder('POST', '/v1/auth/dev-login', { login: `s7k-${run}`, role: 'CODER' }); // sessions were dropped on suspension
ok((await coder('GET', '/v1/me')).body.coderStats.tier === 'GOLD', 'override visible in /v1/me');
await admin('PATCH', `/v1/admin/coders/${coderId}`, { tierOverride: null });
await coder('PUT', '/v1/me/presence', { online: false }); // no offers for this run's funded orders

// ---- dispute split: order assigned + disputed directly (dispatch/milestones have their own smokes) ----
const d = await newOrder(cust);
await cust('POST', '/v1/payments/dev-deposit', { orderId: d.id });
psql(`update core.orders set status = 'DISPUTED', coder_user_id = '${coderId}', dispute_reason = 'smoke' where id = '${d.id}'`);
ok((await admin('GET', '/v1/admin/orders')).body.orders.some((o) => o.id === d.id && o.escrowVnd === d.priceVnd), 'disputed order listed with escrow');
ok((await admin('POST', `/v1/admin/orders/${d.id}/resolve`, { refundVnd: d.priceVnd + 1 })).status === 400, 'refund above escrow 400');
const refundVnd = Math.round(d.priceVnd / 2);
const wallet0 = balance(`coder:${coderId}`);
const res = await admin('POST', `/v1/admin/orders/${d.id}/resolve`, { refundVnd, note: 'chia đôi' });
ok(res.status === 200 && res.body.status === 'RESOLVED' && res.body.escrowVnd === 0, 'DISPUTED -> RESOLVED, escrow empty');
const coderGot = balance(`coder:${coderId}`) - wallet0;
ok(coderGot > 0 && coderGot <= d.priceVnd - refundVnd, `coder got ${coderGot} of the ${d.priceVnd - refundVnd} remainder`);
ok((await admin('POST', `/v1/admin/orders/${d.id}/resolve`, { refundVnd: 0 })).status === 409, 'resolve twice 409');

// ---- part-paid DRAFT refund -> CANCELLED ----
const p = await newOrder(cust);
deposit(`smoke:${run}:p`, p.id, 100_000, `${p.id} part`);
ok((await admin('GET', '/v1/admin/orders')).body.orders.some((o) => o.id === p.id && o.status === 'DRAFT' && o.escrowVnd === 100_000), 'part-paid DRAFT listed');
const rf = await admin('POST', `/v1/admin/orders/${p.id}/refund`);
ok(rf.status === 200 && rf.body.status === 'CANCELLED' && rf.body.escrowVnd === 0 && rf.body.paidVnd === 100_000, 'refund -> CANCELLED, escrow 0');
ok((await admin('POST', `/v1/admin/orders/${p.id}/refund`)).status === 409, 'refund empty escrow 409');

// ---- suspense: move onto an order (funds it), or refund ----
const s = await newOrder(cust);
deposit(`smoke:${run}:s1`, null, s.priceVnd, `nham ma ${run}`);
deposit(`smoke:${run}:s2`, null, 50_000, `lac ${run}`);
const items = (await admin('GET', '/v1/admin/suspense')).body.items;
ok(items.some((i) => i.txId === `smoke:${run}:s1` && i.content === `nham ma ${run}`), 'suspense listed with transfer content');
ok((await admin('POST', `/v1/admin/suspense/smoke:${run}:s1/resolve`, { orderId: s.id })).status === 204, 'suspense -> order');
ok((await cust('GET', `/v1/orders/${s.id}`)).body.status !== 'DRAFT', 'order funded by the moved deposit');
ok((await admin('POST', `/v1/admin/suspense/smoke:${run}:s1/resolve`, { orderId: null })).status === 409, 'reconcile twice 409');
ok((await admin('POST', `/v1/admin/suspense/smoke:${run}:s2/resolve`, { orderId: null })).status === 204, 'suspense refunded');
ok(!(await admin('GET', '/v1/admin/suspense')).body.items.some((i) => i.txId.startsWith(`smoke:${run}`)), 'both gone from suspense list');
psql(`update core.orders set status = 'CANCELLED' where id = '${s.id}'`); // keep it out of later dispatch waves

// ---- payouts ----
const w = balance(`coder:${coderId}`);
const bank = 'VCB 0123456789 NGUYEN A';
ok((await cust('POST', '/v1/me/payouts', { amountVnd: 10_000, bankAccount: bank })).status === 403, 'customer payout 403');
ok((await coder('POST', '/v1/me/payouts', { amountVnd: w + 10_000, bankAccount: bank })).status === 409, 'payout above wallet 409');
const r1 = await coder('POST', '/v1/me/payouts', { amountVnd: 10_000, bankAccount: bank });
ok(r1.status === 201 && r1.body.status === 'PENDING', 'payout requested');
ok((await coder('POST', '/v1/me/payouts', { amountVnd: w, bankAccount: bank })).status === 409, 'pending request reserves the wallet');
const rej = await admin('POST', `/v1/admin/payouts/${r1.body.id}/decide`, { approve: false, note: 'sai STK' });
ok(rej.body.status === 'REJECTED' && balance(`coder:${coderId}`) === w, 'reject keeps the wallet');
const r2 = (await coder('POST', '/v1/me/payouts', { amountVnd: 10_000, bankAccount: bank })).body;
const paid = await admin('POST', `/v1/admin/payouts/${r2.id}/decide`, { approve: true });
ok(paid.body.status === 'PAID' && balance(`coder:${coderId}`) === w - 10_000, 'approve debits the wallet');
ok((await admin('POST', `/v1/admin/payouts/${r2.id}/decide`, { approve: true })).status === 409, 'decide twice 409');
ok((await coder('GET', '/v1/me/payouts')).body.payouts.length === 2, 'coder sees own requests');

// ---- monitor + repo retry ----
psql(`insert into core.order_repos (order_id, coder_user_id, status, error) values ('${d.id}', '${coderId}', 'FAILED', 'smoke') on conflict (order_id) do update set status = 'FAILED'`);
const m = await admin('GET', '/v1/admin/monitor');
ok(m.status === 200 && typeof m.body.outboxPending === 'number', `monitor: outbox ${m.body.outboxPending}, consumers ${m.body.consumers?.length ?? 'n/a'}`);
ok(m.body.failedJobs.some((j) => j.kind === 'repo' && j.orderId === d.id && j.retryable), 'FAILED repo job listed');
ok((await admin('POST', `/v1/admin/jobs/repo/${d.id}/retry`)).status === 204, 'repo retry queued');
ok(psql(`select status from core.order_repos where order_id = '${d.id}'`) === 'PENDING', 'repo job PENDING again');
ok((await admin('POST', `/v1/admin/jobs/repo/${d.id}/retry`)).status === 409, 'retry non-FAILED 409');

// ---- sandbox retry (order p: no repo yet, then a READY repo) ----
psql(`update core.orders set sandbox = '{"status":"FAILED","url":null,"error":"smoke","expiresAt":null}' where id = '${p.id}'`);
ok((await admin('GET', '/v1/admin/monitor')).body.failedJobs.some((j) => j.kind === 'sandbox' && j.orderId === p.id && j.retryable), 'FAILED sandbox listed');
ok((await admin('POST', `/v1/admin/jobs/sandbox/${p.id}/retry`)).status === 409, 'sandbox retry without READY repo 409');
psql(`insert into core.order_repos (order_id, coder_user_id, status, repo_full_name) values ('${p.id}', '${coderId}', 'READY', 'grabcode-sandbox/smoke-${run}') on conflict (order_id) do update set status = 'READY', repo_full_name = 'grabcode-sandbox/smoke-${run}'`);
ok((await admin('POST', `/v1/admin/jobs/sandbox/${p.id}/retry`)).status === 204, 'sandbox retry queued');
ok(psql(`select sandbox->>'status' from core.orders where id = '${p.id}'`) === 'PENDING', 'sandbox PENDING again');
ok(psql(`select count(*) from core.outbox where subject = 'deploy.requested' and payload->'data'->>'orderId' = '${p.id}'`) === '1', 'deploy.requested in outbox');
ok((await admin('POST', `/v1/admin/jobs/sandbox/${p.id}/retry`)).status === 409, 'retry non-FAILED sandbox 409');

// ---- paid order nobody took: listed after 30 min, refund cancels it ----
const u = await newOrder(cust);
await cust('POST', '/v1/payments/dev-deposit', { orderId: u.id });
ok(!(await admin('GET', '/v1/admin/orders')).body.orders.some((o) => o.id === u.id), 'fresh unassigned order not listed');
psql(`update core.orders set created_at = now() - interval '1 hour' where id = '${u.id}'`);
const ul = (await admin('GET', '/v1/admin/orders')).body.orders.find((o) => o.id === u.id);
ok(ul && ['FUNDED', 'DISPATCHED'].includes(ul.status) && ul.escrowVnd === u.priceVnd, `stuck ${ul?.status} order listed with escrow`);
const uc = await admin('POST', `/v1/admin/orders/${u.id}/refund`);
ok(uc.status === 200 && uc.body.status === 'CANCELLED' && uc.body.escrowVnd === 0, 'stuck order refunded -> CANCELLED');
ok(psql(`select count(*) from core.dispatch_offers where order_id = '${u.id}' and status = 'PENDING'`) === '0', 'no open offers left');
