// MVP flow smoke test (HON-8) against a running local core-api (AUTH_DEV_LOGIN=true, only for the admin login).
// Customer posts -> admin confirms the bank transfer -> coder claims from the job board -> hands in links ->
// customer asks for changes / approves -> delivered -> revision -> accepted -> coder paid the order's payout.
// Run: node api/core-api/scripts/smoke-mvp.mjs
const API = process.env.API_URL ?? 'http://localhost:4000';
const ok = (c, m) => {
  console.log(c ? 'OK  ' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const t = await r.text();
    return { status: r.status, body: t ? JSON.parse(t) : null };
  };
}
const run = Date.now().toString(36);
async function register(role, tag) {
  const c = client();
  const r = await c('POST', '/v1/auth/register', { email: `${tag}-${run}@mvp.test`, password: 'mat-khau-123', name: `${tag} ${run}`, role });
  if (r.status !== 201) throw new Error(`register ${tag}: ${r.status}`);
  return Object.assign(c, { id: r.body.id });
}

const cust = await register('CUSTOMER', 'khach');
const coder = await register('CODER', 'fl');
const coder2 = await register('CODER', 'fl2');
const admin = client();
await admin('POST', '/v1/auth/dev-login', { login: `mvp-admin-${run}`, role: 'ADMIN' });

// 1. Customer posts. Client-chosen milestone ids are replaced (duplicates would merge two escrow releases).
const milestones = [20, 80].map((w) => ({ id: 'dup', title: `m${w}`, description: '', weightPercent: w, status: 'COMPLETED' }));
const brief = { title: 'MVP smoke', scopeSummary: 'shop', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones };
const created = await cust('POST', '/v1/orders', { prompt: 'Web bán hàng cho shop', tier: 'STANDARD', brief, phone: '0912345678', acceptTerms: true });
ok(created.status === 201 && created.body.status === 'DRAFT', `order ${created.body.id} DRAFT`);
const o = created.body;
ok(o.brief.milestones.map((m) => `${m.id}:${m.status}`).join() === 'M1:PENDING,M2:PENDING', 'server-assigned milestone ids, progress reset');
ok(o.payoutVnd > 0 && o.payoutVnd < o.priceVnd, `payout ${o.payoutVnd} of ${o.priceVnd} fixed on the order`);

const pay = (await cust('GET', `/v1/orders/${o.id}/payment`)).body;
ok(pay.dueVnd === o.priceVnd && pay.content === o.id.replace('-', ''), `pay ${pay.dueVnd} with content ${pay.content}`);
ok(pay.autoConfirm === false || pay.autoConfirm === true, `autoConfirm=${pay.autoConfirm}`);
ok(!pay.bank || pay.bank.qrUrl.startsWith('https://img.vietqr.io/image/'), `VietQR ${pay.bank ? pay.bank.qrUrl.slice(0, 60) : '(no bank configured)'}`);

// 2. Not paid: not on the board, cannot be claimed.
ok(!(await coder('GET', '/v1/jobs')).body.jobs.some((j) => j.id === o.id), 'unpaid order not on the job board');
ok((await coder('POST', `/v1/jobs/${o.id}/claim`)).status === 409, 'claim unpaid 409');

// 3. Admin confirms the transfer by hand.
const attention = (await admin('GET', '/v1/admin/orders')).body.orders.find((x) => x.id === o.id);
ok(attention?.status === 'DRAFT' && attention.customerEmail?.includes('@mvp.test'), 'admin sees the unpaid order with customer email');
ok((await cust('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: o.priceVnd, reference: 'FT1' })).status === 403, 'customer cannot confirm payments');
ok((await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: 0, reference: 'FT1' })).status === 400, 'amount 0 rejected');
const half = Math.floor(o.priceVnd / 2);
const p1 = await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: half, reference: 'ft 100' });
ok(p1.status === 200 && p1.body.status === 'DRAFT' && p1.body.paidVnd === half, 'part payment keeps DRAFT');
ok((await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: half, reference: 'FT100' })).status === 409, 'same bank reference twice 409');
const p2 = await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: o.priceVnd - half, reference: 'FT101' });
ok(p2.status === 200 && ['FUNDED', 'DISPATCHED'].includes(p2.body.status), `fully paid -> ${p2.body.status}`);
ok((await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: 1000, reference: 'FT102' })).status === 409, 'confirm on a paid order 409');

// 4. Job board + claim (first claim wins, own orders hidden, customers without CODER role refused).
ok((await cust('GET', '/v1/jobs')).status === 403, 'customer without CODER role: 403 on the board');
ok((await coder('GET', '/v1/jobs')).body.jobs.some((j) => j.id === o.id), 'paid order on the job board');
const claims = await Promise.all([coder('POST', `/v1/jobs/${o.id}/claim`), coder2('POST', `/v1/jobs/${o.id}/claim`)]);
const codes = claims.map((r) => r.status).sort();
ok(codes[0] === 200 && codes[1] === 409, `concurrent claims -> ${codes.join(',')}`);
const k = claims[0].status === 200 ? coder : coder2;
const other = k === coder ? coder2 : coder;
const order = (await cust('GET', `/v1/orders/${o.id}`)).body;
ok(order.status === 'IN_PROGRESS' && order.coder?.id === k.id, 'IN_PROGRESS with the winner');
ok(!(await other('GET', '/v1/jobs')).body.jobs.some((j) => j.id === o.id), 'taken order leaves the board');

// 5. Hand in by link; customer asks for changes, then approves.
const ms = (id) => `/v1/orders/${o.id}/milestones/${id}`;
ok((await k('POST', `${ms('M1')}/submit`, {})).status === 400, 'empty hand-in 400');
ok((await k('POST', `${ms('M1')}/submit`, { deliveryUrl: 'javascript:alert(1)' })).status === 400, 'javascript: link 400');
ok((await other('POST', `${ms('M1')}/submit`, { note: 'x' })).status === 404, 'other coder cannot submit');
const s1 = await k('POST', `${ms('M1')}/submit`, { deliveryUrl: 'https://demo.example.vn/m1', note: 'bản đầu' });
ok(s1.status === 200 && s1.body.brief.milestones[0].deliveryUrl === 'https://demo.example.vn/m1', 'M1 submitted with link');
ok((await k('POST', `${ms('M1')}/approve`)).status === 403, 'coder cannot approve');
const rej = await cust('POST', `${ms('M1')}/reject`, { note: 'đổi màu nút' });
ok(rej.body.brief.milestones[0].status === 'IN_PROGRESS' && rej.body.brief.milestones[0].note === 'đổi màu nút', 'revision requested with note');
await k('POST', `${ms('M1')}/submit`, { deliveryUrl: 'https://demo.example.vn/m1-v2' });
const a1 = await cust('POST', `${ms('M1')}/approve`);
ok(a1.body.brief.milestones[0].status === 'COMPLETED', 'M1 approved');
const w1 = (await k('GET', '/v1/me/wallet')).body.balanceVnd;
ok(w1 === Math.round(o.payoutVnd * 0.2), `M1 released 20% of the payout (${w1})`);

await k('POST', `${ms('M2')}/submit`, { deliveryUrl: 'https://github.com/someone/shop' });
await cust('POST', `${ms('M2')}/approve`);
ok((await k('POST', `/v1/orders/${o.id}/transitions`, { status: 'DELIVERED' })).body.status === 'DELIVERED', 'coder delivers');
ok((await cust('POST', `/v1/orders/${o.id}/transitions`, { status: 'IN_PROGRESS' })).body.status === 'IN_PROGRESS', 'customer requests a final revision');
await k('POST', `/v1/orders/${o.id}/transitions`, { status: 'DELIVERED' });
ok((await cust('POST', `/v1/orders/${o.id}/transitions`, { status: 'ACCEPTED' })).body.status === 'ACCEPTED', 'customer accepts');
ok((await k('GET', '/v1/me/wallet')).body.balanceVnd === o.payoutVnd, `coder paid the order payout ${o.payoutVnd}`);
const all = (await admin('GET', '/v1/admin/orders?view=all')).body.orders.find((x) => x.id === o.id);
ok(all?.status === 'ACCEPTED' && all.escrowVnd === 0 && all.paidVnd === o.priceVnd, 'admin view=all: ACCEPTED, escrow empty');

// 6. Suspension ends every session and blocks login.
await admin('PATCH', `/v1/admin/coders/${other.id}`, { suspended: true });
ok((await other('GET', '/v1/jobs')).status === 401, 'suspended coder signed out');
const relog = await client()('POST', '/v1/auth/login', { email: `${other === coder ? 'fl' : 'fl2'}-${run}@mvp.test`, password: 'mat-khau-123' });
ok(relog.status === 403, `suspended login ${relog.status}`);

// 7. Login throttle holds under a parallel burst (10 failures / email / 15 min).
const anon = client();
const burst = await Promise.all(Array.from({ length: 15 }, () => anon('POST', '/v1/auth/login', { email: `nobody-${run}@mvp.test`, password: 'wrong-pass' })));
const n401 = burst.filter((r) => r.status === 401).length;
ok(n401 <= 10 && burst.filter((r) => r.status === 429).length >= 5, `parallel burst: ${n401}x401, rest 429`);
