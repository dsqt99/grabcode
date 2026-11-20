// S4 milestone smoke test against a running local core-api (AUTH_DEV_LOGIN=true) + docker compose Postgres.
// Run: node api/core-api/scripts/smoke-milestones.mjs
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

/** Order funded, dispatched and accepted by `coder` (the only online coder of this run gets the offer). */
async function startOrder(cust, coder, weights) {
  const milestones = weights.map((w, i) => ({ id: `M${i + 1}`, title: `m${i + 1}`, description: '', weightPercent: w, status: 'PENDING' }));
  const brief = { title: 'S4 smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones };
  const o = (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief })).body;
  await cust('POST', '/v1/payments/dev-deposit', { orderId: o.id });
  for (let i = 0; i < 40; i++) {
    const { offers } = (await coder('GET', '/v1/me/offers')).body;
    const mine = offers.find((x) => x.orderId === o.id);
    if (mine) {
      await coder('POST', `/v1/offers/${mine.id}/accept`);
      return (await cust('GET', `/v1/orders/${o.id}`)).body;
    }
    for (const x of offers) await coder('POST', `/v1/offers/${x.id}/decline`);
    await sleep(1000);
  }
  throw new Error(`no offer for ${o.id}`);
}

const balance = (acct) => Number(psql(`select coalesce(sum(amount_vnd),0) from core.ledger_entries where account = '${acct}'`));
const run = Date.now().toString(36);
const cust = await client('s4cust', 'CUSTOMER');
const coder = await client(`s4k-${run}`, 'CODER');
const coderId = (await coder('GET', '/v1/me')).body.id;
await coder('PUT', '/v1/me/presence', { online: true });

// Happy path: 20/50/30, reject once, then approve each -> each approve releases exactly its share.
const o = await startOrder(cust, coder, [20, 50, 30]);
ok(o.status === 'IN_PROGRESS', `${o.id} IN_PROGRESS (${o.priceVnd} VND)`);
const ms = (id) => `/v1/orders/${o.id}/milestones/${id}`;
ok((await coder('POST', `${ms('M2')}/submit`, { note: 'x' })).status === 409, 'out-of-order submit 409');
ok((await coder('POST', `${ms('M1')}/submit`, { commitHash: 'deadbeef' })).status === 400, 'unknown commit 400');
psql(`insert into core.order_repos (order_id, coder_user_id, status, repo_full_name, collaborator) values ('${o.id}', '${coderId}', 'READY', 'grabcode-sandbox/smoke-${run}', 's4k') on conflict do nothing`);
psql(`insert into core.repo_commits values ('abc1234${run}', '${o.id}', 'feat', 'k', 'https://x', now()) on conflict do nothing`);
const s1 = await coder('POST', `${ms('M1')}/submit`, { commitHash: 'abc1234', note: 'xong M1' });
ok(s1.status === 200 && s1.body.brief.milestones[0].status === 'SUBMITTED', 'M1 SUBMITTED');
ok(s1.body.brief.milestones[0].commitHash === `abc1234${run}`, 'commit prefix resolved to full sha');
ok((await coder('POST', `${ms('M1')}/approve`)).status === 403, 'coder cannot approve 403');
ok((await cust('POST', `${ms('M1')}/reject`, { note: '' })).status === 400, 'reject without note 400');
const r1 = await cust('POST', `${ms('M1')}/reject`, { note: 'sửa header' });
ok(r1.body.brief.milestones[0].status === 'IN_PROGRESS' && r1.body.brief.milestones[0].note === 'sửa header', 'reject -> IN_PROGRESS + note');
ok(balance(`escrow:${o.id}`) === o.priceVnd, 'reject releases nothing');

let paid = 0;
const shares = [];
for (const [i, w] of [20, 50, 30].entries()) {
  const id = `M${i + 1}`;
  await coder('POST', `${ms(id)}/submit`, { note: 'x' });
  const before = balance(`escrow:${o.id}`);
  const a = await cust('POST', `${ms(id)}/approve`);
  const share = before - balance(`escrow:${o.id}`);
  shares.push(share);
  paid += share;
  ok(a.status === 200 && a.body.brief.milestones[i].status === 'COMPLETED', `${id} approved, released ${share} (~${w}%)`);
}
ok((await cust('POST', `${ms('M3')}/approve`)).status === 409, 'double approve 409');
ok(paid === o.priceVnd && balance(`escrow:${o.id}`) === 0, `shares ${shares.join('+')} = price ${o.priceVnd}, escrow empty`);
ok(balance(`coder:${coderId}`) >= o.payoutVnd, 'coder credited the payout');
await coder('POST', `/v1/orders/${o.id}/transitions`, { status: 'DELIVERED' });
const acc = await cust('POST', `/v1/orders/${o.id}/transitions`, { status: 'ACCEPTED' });
ok(acc.body.status === 'ACCEPTED', 'ACCEPTED after all milestones');
ok(psql(`select count(*) from core.ledger_txs where order_id = '${o.id}' and kind = 'RELEASE'`) === '3', 'ACCEPTED released nothing twice');
ok(psql(`select count(*) from core.outbox where subject = 'repo.handover.requested' and payload->'data'->>'orderId' = '${o.id}'`) === '1', 'handover requested for READY repo');
ok(psql(`select count(*) from core.outbox where subject like 'milestone.%' and payload->'data'->>'orderId' = '${o.id}'`) === '8', 'milestone events: 4 submit + 1 reject + 3 approve');

// Dispute mid-way: M1 paid, then dispute freezes the rest of the escrow.
const d = await startOrder(cust, coder, [50, 50]);
const dm = (id) => `/v1/orders/${d.id}/milestones/${id}`;
await coder('POST', `${dm('M1')}/submit`, { note: 'x' });
await cust('POST', `${dm('M1')}/approve`);
await coder('POST', `${dm('M2')}/submit`, { note: 'x' });
ok((await cust('POST', `/v1/orders/${d.id}/transitions`, { status: 'DISPUTED' })).status === 400, 'dispute without reason 400');
const dis = await cust('POST', `/v1/orders/${d.id}/transitions`, { status: 'DISPUTED', reason: 'M2 thiếu tính năng' });
ok(dis.body.status === 'DISPUTED' && dis.body.disputeReason === 'M2 thiếu tính năng', 'IN_PROGRESS -> DISPUTED with reason');
ok((await cust('POST', `${dm('M2')}/approve`)).status === 409, 'approve while DISPUTED 409');
ok(balance(`escrow:${d.id}`) === d.priceVnd - Math.round(d.priceVnd / 2), 'second half stays frozen in escrow');
