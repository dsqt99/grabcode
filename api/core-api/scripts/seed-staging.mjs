// Demo data for the STAGING server only (docs/STAGING.md): 1 customer, 3 freelancers, 1 admin and one order in each of
// the states a demo needs. Everything goes through the real API (register, quote, confirm-payment, claim, submit...),
// so the data is what the product itself would produce. Run by `infra/deploy/staging-up.sh` inside the core-api image.
//
// Refuses to run unless APP_ENV=staging (production never sets it). Re-running is safe: when the demo customer already
// exists it prints the logins and exits; `staging-reset.sh` wipes the data first.
//
// Env: API_URL (default http://core-api:4000), STAGING_DEV_LOGIN_KEY, DEMO_PASSWORD (8+ chars), DATABASE_URL.
import postgres from 'postgres';

if (process.env.APP_ENV !== 'staging' || process.env.AUTH_DEV_LOGIN !== 'true') {
  console.error('seed-staging: refused. It only runs when APP_ENV=staging and AUTH_DEV_LOGIN=true (never on production).');
  process.exit(2);
}
const API = process.env.API_URL ?? 'http://core-api:4000';
const KEY = process.env.STAGING_DEV_LOGIN_KEY ?? '';
const PASSWORD = process.env.DEMO_PASSWORD ?? '';
if (PASSWORD.length < 8 || KEY.length < 16) {
  console.error('seed-staging: DEMO_PASSWORD (8+ chars) and STAGING_DEV_LOGIN_KEY (16+ chars) are required.');
  process.exit(2);
}

const EMAILS = {
  customer: 'khach@staging.grabcode.test',
  f1: 'freelancer1@staging.grabcode.test',
  f2: 'freelancer2@staging.grabcode.test',
  f3: 'freelancer-cho-duyet@staging.grabcode.test',
  admin: 'admin@staging.grabcode.test',
};

function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'x-dev-login-key': KEY, cookie }, body: body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const t = await r.text();
    return { status: r.status, body: t ? JSON.parse(t) : null };
  };
  return call;
}
const must = (r, what, ...okCodes) => {
  if (!(okCodes.length ? okCodes : [200, 201]).includes(r.status)) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

async function register(email, name, role) {
  const c = client();
  const r = await c('POST', '/v1/auth/register', { email, password: PASSWORD, name, role });
  return Object.assign(c, { id: must(r, `register ${email}`).id, status: r.status });
}

const printLogins = () => {
  console.log('\nTài khoản demo (mật khẩu = DEMO_PASSWORD trong .env.staging):');
  console.log(`  Khách hàng           ${EMAILS.customer}`);
  console.log(`  Freelancer (có đơn)  ${EMAILS.f1}   (đã làm xong 1 đơn, đang làm 1 đơn)`);
  console.log(`  Freelancer (rảnh)    ${EMAILS.f2}   (nhận được đơn "chờ nhận")`);
  console.log(`  Freelancer chờ duyệt ${EMAILS.f3}   (admin chưa duyệt)`);
  console.log(`  Admin                ${EMAILS.admin}  → /admin`);
};

// The admin account is created LAST: its existence means a previous run finished.
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const done = await sql`select 1 from core.users where email = ${EMAILS.admin}`;
if (done.length) {
  console.log('seed-staging: dữ liệu mẫu đã có, bỏ qua (muốn làm lại: infra/deploy/staging-reset.sh).');
  printLogins();
  await sql.end();
  process.exit(0);
}
const partial = await sql`select 1 from core.users where email = ${EMAILS.customer}`;
if (partial.length) {
  console.error('seed-staging: lần seed trước dừng giữa chừng. Chạy infra/deploy/staging-reset.sh để làm lại từ đầu.');
  process.exit(1);
}

const customer = await register(EMAILS.customer, 'Khách Demo', 'CUSTOMER');
const f1 = await register(EMAILS.f1, 'Freelancer Một', 'CODER');
const f2 = await register(EMAILS.f2, 'Freelancer Hai', 'CODER');
await register(EMAILS.f3, 'Freelancer Chờ Duyệt', 'CODER'); // stays PENDING: the admin approves it live in the demo
const adminUser = await register(EMAILS.admin, 'Admin Demo', 'CUSTOMER');
await sql`update core.users set roles = array_append(roles, 'ADMIN') where id = ${adminUser.id} and not 'ADMIN' = any(roles)`;
await sql.end();
// The ADMIN role is read per request, but sign in again to be sure the session sees it.
const admin = client();
must(await admin('POST', '/v1/auth/login', { email: EMAILS.admin, password: PASSWORD }), 'admin login', 200);

for (const [c, label] of [[f1, 'f1'], [f2, 'f2']]) {
  must(await admin('PATCH', `/v1/admin/coders/${c.id}`, { approval: 'APPROVED' }), `approve ${label}`);
}

const brief = (title, summary, names) => ({
  title,
  scopeSummary: summary,
  features: ['Giao diện responsive', 'Form liên hệ gửi về email/Zalo', 'Tối ưu tốc độ tải trang'],
  inScope: ['Thiết kế + code', 'Deploy lên tên miền của khách'],
  outOfScope: ['Chạy quảng cáo', 'Viết nội dung'],
  acceptanceCriteria: ['Mở tốt trên điện thoại', 'Form gửi được'].map((text, i) => ({ id: `AC${i + 1}`, text, passed: false })),
  claudeMdContent: `# ${title}\nDự án demo staging.`,
  milestones: names.map(([t, w]) => ({ id: 'x', title: t, description: '', weightPercent: w, status: 'PENDING' })),
});
const MS = [['Bản thiết kế', 20], ['Bản chạy được', 50], ['Hoàn thiện + bàn giao', 30]];
const place = async (menuItem, prompt, title) =>
  must(await customer('POST', '/v1/orders', { prompt, menuItem, brief: brief(title, prompt, MS), phone: '0912345678', acceptTerms: true }), `create ${title}`);
const quote = async (o, priceVnd, etaDays) => must(await admin('POST', `/v1/admin/orders/${o.id}/quote`, { priceVnd, etaDays }), `quote ${o.id}`);
const pay = async (o, priceVnd, ref) => must(await admin('POST', `/v1/admin/orders/${o.id}/confirm-payment`, { amountVnd: priceVnd, reference: ref }), `confirm ${o.id}`);
const claim = async (c, o) => must(await c('POST', `/v1/jobs/${o.id}/claim`), `claim ${o.id}`);
const ms = (o, id) => `/v1/orders/${o.id}/milestones/${id}`;
const submit = async (c, o, id, url) => must(await c('POST', `${ms(o, id)}/submit`, { deliveryUrl: url, note: 'Em đã xong phần này, anh/chị xem giúp ạ.' }), `submit ${o.id} ${id}`);
const approve = async (o, id) => must(await customer('POST', `${ms(o, id)}/approve`), `approve ${o.id} ${id}`);
const move = async (c, o, status) => must(await c('POST', `/v1/orders/${o.id}/transitions`, { status }), `${o.id} -> ${status}`);

// A. ACCEPTED: finished and paid out to freelancer 1 (wallet has money, one withdrawal request waits for the admin).
const a = await place('DEMO_LANDING', 'Mình bán khóa học tiếng Anh online, cần 1 trang có form đăng ký tư vấn.', 'Demo trang khóa học tiếng Anh');
await quote(a, 1_500_000, 2);
await pay(a, 1_500_000, 'FT-DEMO-A1');
await claim(f1, a);
for (const id of ['M1', 'M2', 'M3']) {
  await submit(f1, a, id, `https://demo.staging.grabcode.test/landing-anh-van/${id.toLowerCase()}`);
  await approve(a, id);
}
await move(f1, a, 'DELIVERED');
await move(customer, a, 'ACCEPTED');
const wallet = must(await f1('GET', '/v1/me/wallet'), 'wallet f1').balanceVnd;
const withdraw = Math.min(1_000_000, Math.floor(wallet / 1000) * 1000);
if (withdraw >= 10_000) must(await f1('POST', '/v1/me/payouts', { amountVnd: withdraw, bankAccount: 'MB Bank 0123456789 NGUYEN VAN DEMO' }), 'payout request');

// B. DELIVERED: all milestones approved, waiting for the customer to accept (demo step "nghiệm thu").
const b = await place('DEMO_AI_DOCS', 'Mình có 40 file PDF chính sách bảo hành nội thất, muốn có chat hỏi đáp để show khách.', 'Demo chat hỏi đáp tài liệu An Phát');
await quote(b, 2_900_000, 3);
await pay(b, 2_900_000, 'FT-DEMO-B1');
await claim(f1, b);
for (const id of ['M1', 'M2', 'M3']) {
  await submit(f1, b, id, `https://demo.staging.grabcode.test/noi-that-an-phat/${id.toLowerCase()}`);
  await approve(b, id);
}
await move(f1, b, 'DELIVERED');

// C. IN_PROGRESS: freelancer 1 handed in milestone 1, the customer has not reviewed it yet (demo step "duyệt mốc").
const c = await place('DEMO_SHOP', 'Mình có 30 mẫu mỹ phẩm handmade, muốn khách thêm giỏ và đặt thử trên điện thoại.', 'Demo shop mỹ phẩm handmade');
await quote(c, 2_900_000, 3);
await pay(c, 2_900_000, 'FT-DEMO-C1');
await claim(f1, c);
await submit(f1, c, 'M1', 'https://demo.staging.grabcode.test/my-pham/m1');

// D. FUNDED: paid, nobody took it. The demo freelancer (freelancer 2) claims it live from "Việc đang chờ nhận".
const d = await place('DEMO_BOOKING', 'Tiệm tóc mình muốn khách tự chọn dịch vụ và giờ, khỏi nhắn tin qua lại.', 'Demo đặt lịch tiệm tóc Minh Anh');
await quote(d, 2_400_000, 3);
await pay(d, 2_400_000, 'FT-DEMO-D1');

// E. DRAFT, quoted: waiting for the customer's bank transfer (demo step "thanh toán": QR + admin confirms).
const e = await place('DEMO_CHATBOT', 'Phòng khám nha khoa mình tối nào khách cũng hỏi giá, bot trả lời giùm được không?', 'Demo chatbot phòng khám nha khoa');
await quote(e, 2_000_000, 3);

// F. DRAFT, not quoted: waiting for the admin's quote (demo step "báo giá").
await place('DEMO_LANDING', 'Mình bán cà phê rang xay, cần 1 trang có nút đặt qua Zalo, 2 ngày làm được không?', 'Demo trang cà phê rang xay');

console.log('seed-staging: đã tạo 6 đơn mẫu (ACCEPTED, DELIVERED, IN_PROGRESS, FUNDED chờ nhận, DRAFT chờ chuyển khoản, DRAFT chờ báo giá).');
printLogins();
