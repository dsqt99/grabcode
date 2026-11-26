// Fake core-api for screenshots of apps/web (HON-52). NOT the real backend: fixed fixtures shaped like the contracts
// (OrderDto, PaymentInstructions, OrderRepo, ChatList, Me), one order per customer-facing status.
// Run: node docs/redesign/web/fake-api.mjs  (port 4010), then NEXT_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @grabcode/web dev
// POST /__anon?on=1 switches to signed-out. Mutations only echo the order back; nothing is persisted.
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4010);
const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
let anon = false;

const ME = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Chị Lan', email: 'lan@example.com', githubLogin: null, avatarUrl: null,
  roles: ['CUSTOMER'], currency: 'VND', phone: '0912345678', country: 'VN', timezone: 'Asia/Ho_Chi_Minh',
  notifications: { email: false, zalo: false, push: false }, hasPassword: true, loginMethod: 'email', linkedProviders: [],
};
const CODER = { id: '22222222-2222-4222-8222-222222222222', name: 'Minh', avatarUrl: null, stats: { tier: 'SILVER', completedOrders: 0, rating: null } };
const PRICE = 11_000_000;
const t = (h) => new Date(Date.UTC(2026, 10, 20, 2 + h)).toISOString();

const ms = (states, extra = {}) =>
  [
    ['M1', 'Bản thiết kế & trang chủ', 'Giao diện trang chủ, danh sách phòng, bản mobile.', 30],
    ['M2', 'Đặt phòng & thanh toán', 'Luồng đặt phòng, xác nhận qua Zalo, VietQR.', 40],
    ['M3', 'Quản trị & bàn giao', 'Trang quản trị, hướng dẫn sử dụng, bàn giao mã nguồn.', 30],
  ].map(([id, title, description, weightPercent], i) => ({ id, title, description, weightPercent, status: states[i], ...(extra[id] ?? {}) }));

const brief = (milestones) => ({
  title: 'Web đặt phòng homestay có thanh toán VietQR',
  scopeSummary: 'Web đặt phòng cho 1 homestay: xem phòng, đặt lịch, chuyển khoản VietQR, trang quản trị đơn.',
  features: ['Danh sách phòng có ảnh, giá theo ngày', 'Đặt phòng và nhận mã chuyển khoản', 'Trang quản trị đơn đặt'],
  inScope: ['Bản web chạy trên điện thoại'], outOfScope: ['App iOS/Android'],
  acceptanceCriteria: [{ id: 'A1', text: 'Đặt được phòng trên điện thoại', passed: false }],
  milestones, claudeMdContent: '# CLAUDE.md\n…',
});
const sub = (url, note, qa = 'PASSED') => ({
  deliveryUrl: url, note, submittedAt: t(20), commitHash: 'a1b2c3d',
  qa: { status: qa, commitHash: 'a1b2c3d', checks: [{ name: 'build', status: qa === 'FAILED' ? 'FAILED' : 'PASSED', detail: qa === 'FAILED' ? 'Error: Cannot find module ./booking' : '' }] },
});
const done = (url) => ({ deliveryUrl: url, completedAt: t(10), commitHash: 'f00ba12' });

const money = (paidVnd, heldVnd, releasedVnd, refundedVnd = 0) => ({ paidVnd, heldVnd, releasedVnd, refundedVnd });
const order = (id, status, milestones, m, extra = {}) => ({
  id, status, tier: 'STANDARD', menuItem: 'DEMO_BOOKING', title: 'Web đặt phòng homestay Đà Lạt có thanh toán VietQR', prompt: 'Dựng web đặt phòng homestay có thanh toán VietQR',
  templateId: null, framework: 'Next.js 15 + Tailwind CSS', brief: brief(milestones), priceVnd: PRICE, priceQuotedAt: t(1), payoutVnd: 8_250_000,
  money: m, fundedAt: status === 'DRAFT' ? null : t(2), etaHours: 240, disputeReason: null, sandbox: null,
  customer: { id: ME.id, name: ME.name, avatarUrl: null }, coder: ['DRAFT', 'FUNDED', 'DISPATCHED'].includes(status) || id === 'GC-2010' ? null : CODER,
  createdAt: t(0), updatedAt: t(Number(id.slice(-2))), ...extra,
});

const P = ['PENDING', 'PENDING', 'PENDING'];
const ORDERS = [
  order('GC-2001', 'DRAFT', ms(P), money(0, 0, 0), { priceQuotedAt: null, priceVnd: 4_500_000, title: 'Landing page giới thiệu tiệm bánh' }),
  order('GC-2002', 'DRAFT', ms(P), money(0, 0, 0)),
  order('GC-2003', 'FUNDED', ms(P), money(PRICE, PRICE, 0), { fundedAt: new Date(Date.now() - 45 * 60_000).toISOString() }),
  order('GC-2004', 'IN_PROGRESS', ms(['SUBMITTED', 'PENDING', 'PENDING'], { M1: sub('https://demo.example.com/homestay/m1', 'Đã xong trang chủ và danh sách phòng, anh/chị xem trên điện thoại giúp em.') }), money(PRICE, PRICE, 0)),
  order('GC-2005', 'IN_PROGRESS', ms(['COMPLETED', 'IN_PROGRESS', 'PENDING'], { M1: done('https://demo.example.com/homestay/m1'), M2: { note: 'Nút đặt phòng chưa bấm được trên iPhone, sửa giúp mình.' } }), money(PRICE, 7_700_000, 3_300_000)),
  order('GC-2006', 'DELIVERED', ms(['COMPLETED', 'COMPLETED', 'COMPLETED'], { M1: done('https://demo.example.com/homestay/m1'), M2: done('https://demo.example.com/homestay/m2'), M3: done('https://demo.example.com/homestay/m3') }), money(PRICE, 3_300_000, 7_700_000)),
  order('GC-2007', 'ACCEPTED', ms(['COMPLETED', 'COMPLETED', 'COMPLETED'], { M1: done('https://demo.example.com/homestay/m1'), M2: done('https://demo.example.com/homestay/m2'), M3: done('https://demo.example.com/homestay/m3') }), money(PRICE, 0, PRICE)),
  order('GC-2008', 'DISPUTED', ms(['COMPLETED', 'SUBMITTED', 'PENDING'], { M1: done('https://demo.example.com/homestay/m1'), M2: sub('https://demo.example.com/homestay/m2', 'Đã xong luồng đặt phòng.') }), money(PRICE, 7_700_000, 3_300_000), { disputeReason: 'Freelancer giao thiếu chức năng thanh toán, nhắn 3 ngày không trả lời.' }),
  order('GC-2009', 'RESOLVED', ms(['COMPLETED', 'SUBMITTED', 'PENDING'], { M1: done('https://demo.example.com/homestay/m1') }), money(PRICE, 0, 7_000_000, 4_000_000)),
  order('GC-2010', 'CANCELLED', ms(P), money(5_000_000, 0, 0, 5_000_000)),
  order('GC-2011', 'IN_PROGRESS', ms(['COMPLETED', 'COMPLETED', 'SUBMITTED'], { M1: done('https://demo.example.com/homestay/m1'), M2: done('https://demo.example.com/homestay/m2'), M3: sub('https://demo.example.com/homestay/m3', 'Bản cuối, có hướng dẫn sử dụng.', 'FAILED') }), money(PRICE, 3_300_000, 7_700_000)),
];
const byId = Object.fromEntries(ORDERS.map((o) => [o.id, o]));

const REPO = (id) => ({
  orderId: id, status: 'READY', repoFullName: `fastdemo-orders/${id}`, htmlUrl: `https://github.com/fastdemo-orders/${id}`, cloneUrl: null, collaborator: 'minh-dev', error: null,
  handedOverAt: null, handedOverTo: null, createdAt: t(3), updatedAt: t(20),
  commits: [
    { sha: 'f00ba12aaaaaaa', message: 'feat: trang quản trị đơn', author: 'minh-dev', url: '', pushedAt: t(19) },
    { sha: 'a1b2c3daaaaaaa', message: 'feat: luồng đặt phòng + VietQR', author: 'minh-dev', url: '', pushedAt: t(12) },
  ],
});
const payment = (o) => {
  const quoted = !!o.priceQuotedAt;
  const content = o.id.replace('-', '');
  return {
    orderId: o.id, priceVnd: o.priceVnd, paidVnd: o.money.paidVnd, dueVnd: o.status === 'DRAFT' ? o.priceVnd - o.money.paidVnd : 0, content, priceQuoted: quoted,
    bank: quoted
      ? { name: 'MB Bank (DEMO)', accountNumber: '0000 0000 00', accountName: 'CONG TY FASTDEMO DEMO', qrUrl: `https://img.vietqr.io/image/MB-0000000000-compact2.png?amount=${o.priceVnd}&addInfo=${content}` }
      : null,
    autoConfirm: false, devDeposit: false, reportedAt: null,
  };
};
const chat = (id) => ({
  messages: [
    { id: `${id}-1`, orderId: id, sender: 'SYSTEM', senderName: 'Hệ thống', text: `Đơn ${id} đã nhận 11.000.000 đ và đã lên bảng việc.`, timestamp: t(2) },
    { id: `${id}-2`, orderId: id, sender: 'CODER', senderName: 'Minh', text: 'Chào chị, em đã nhận đơn và làm theo các mốc nhé.', timestamp: t(3) },
    { id: `${id}-3`, orderId: id, sender: 'CUSTOMER', senderName: ME.name, text: 'Ok em, nhớ làm bản điện thoại trước giúp chị.', timestamp: t(4) },
  ],
});

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    res.setHeader('access-control-allow-origin', WEB);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE');
    if (req.method === 'OPTIONS') return json(res, 204);
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;
    if (p === '/__anon') return (anon = url.searchParams.get('on') === '1'), json(res, 200, { anon });
    if (p === '/v1/auth/providers') return json(res, 200, { password: true, github: false, google: false, dev: false });
    if (p === '/v1/me') return anon ? json(res, 401, { error: 'unauthorized' }) : json(res, 200, ME);
    if (p.startsWith('/v1/briefs')) {
      const b = brief(ms(P));
      return json(res, 200, { id: '33333333-3333-4333-8333-333333333333', status: 'READY', prompt: '', tier: 'STANDARD', templateId: null, framework: 'Next.js 15 + Tailwind CSS', brief: b, error: null, createdAt: t(0), updatedAt: t(0) });
    }
    if (p === '/v1/realtime/token') return json(res, 404, { error: 'not configured' });
    if (p === '/v1/orders' && req.method === 'GET') return json(res, 200, { orders: ORDERS });
    let m;
    if ((m = /^\/v1\/orders\/([^/]+)\/payment(\/reported)?$/.exec(p))) {
      const o = byId[decodeURIComponent(m[1])];
      return o ? json(res, 200, { ...payment(o), reportedAt: m[2] ? new Date().toISOString() : null }) : json(res, 404, {});
    }
    if ((m = /^\/v1\/orders\/([^/]+)\/messages$/.exec(p))) return json(res, 200, chat(decodeURIComponent(m[1])));
    if ((m = /^\/v1\/orders\/([^/]+)\/refund-account$/.exec(p))) {
      const id = decodeURIComponent(m[1]);
      return json(res, 200, { refundAccount: id === 'GC-2003' ? { bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'NGUYEN THI LAN' } : null });
    }
    if ((m = /^\/v1\/repos\/([^/]+)$/.exec(p))) {
      const o = byId[decodeURIComponent(m[1])];
      return o && ['DELIVERED', 'ACCEPTED'].includes(o.status) ? json(res, 200, REPO(o.id)) : json(res, 404, {});
    }
    if ((m = /^\/v1\/orders\/([^/]+)/.exec(p))) {
      const o = byId[decodeURIComponent(m[1])];
      return o ? json(res, 200, o) : json(res, 404, {});
    }
    json(res, 404, {});
  })
  .listen(PORT, () => console.log(`fake core-api on :${PORT}`));
