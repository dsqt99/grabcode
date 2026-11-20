// S6 smoke: realtime token + Centrifugo hint delivery + order chat, against running core-api (AUTH_DEV_LOGIN=true,
// CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY set) and `docker compose up -d centrifugo`.
// Run: node api/core-api/scripts/smoke-realtime.mjs
const API = process.env.API_URL ?? 'http://localhost:4000';
const ok = (c, m) => {
  console.log(c ? 'OK  ' : 'FAIL', m);
  if (!c) process.exitCode = 1;
};

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

/** Connects to Centrifugo with the user's token, collects pushed hints. */
async function listen(call) {
  const { status, body } = await call('GET', '/v1/realtime/token');
  if (status !== 200) throw new Error(`token ${status}: realtime not configured?`);
  const hints = [];
  const ws = new WebSocket(body.url);
  await new Promise((resolve, reject) => {
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, connect: { token: body.token } }));
    ws.onerror = reject;
    ws.onmessage = (e) => {
      for (const line of String(e.data).split('\n').filter((l) => l.trim())) {
        const msg = JSON.parse(line);
        if (msg.id === 1) (msg.connect ? resolve : reject)(msg.error);
        if (msg.push?.pub?.data) hints.push(msg.push.pub.data);
        if (!Object.keys(msg).length) ws.send('{}');
      }
    };
  });
  return { hints, close: () => ws.close() };
}
const waitFor = async (hints, pred) => {
  for (let i = 0; i < 30; i++) {
    if (hints.some(pred)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};

const run = Date.now().toString(36);
const cust = await client(`s6c-${run}`, 'CUSTOMER');
const other = await client(`s6x-${run}`, 'CUSTOMER');
const rt = await listen(cust);
ok(true, 'customer connected to Centrifugo');

const brief = { title: 'S6 smoke', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '', milestones: [{ id: 'M1', title: 'm1', description: '', weightPercent: 100, status: 'PENDING' }] };
const o = (await cust('POST', '/v1/orders', { prompt: 'smoke', tier: 'EXPRESS', brief, phone: '0912345678', acceptTerms: true })).body;
ok(await waitFor(rt.hints, (h) => h.type === 'order' && h.orderId === o.id), 'order created -> order hint');

const sent = await cust('POST', `/v1/orders/${o.id}/messages`, { text: '  hello coder  ' });
ok(sent.status === 201 && sent.body.text === 'hello coder' && sent.body.sender === 'CUSTOMER', `chat POST -> ${sent.status}`);
ok(await waitFor(rt.hints, (h) => h.type === 'chat' && h.orderId === o.id), 'chat -> chat hint');
const list = await cust('GET', `/v1/orders/${o.id}/messages`);
ok(list.body.messages.length === 1 && list.body.messages[0].id === sent.body.id, 'chat GET returns the message');
ok((await cust('POST', `/v1/orders/${o.id}/messages`, { text: '   ' })).status === 400, 'blank chat -> 400');
ok((await other('GET', `/v1/orders/${o.id}/messages`)).status === 404, 'non-party chat GET -> 404');
ok((await other('POST', `/v1/orders/${o.id}/messages`, { text: 'x' })).status === 404, 'non-party chat POST -> 404');

const ox = await listen(other);
await cust('POST', `/v1/orders/${o.id}/messages`, { text: 'private' });
await new Promise((r) => setTimeout(r, 1500));
ok(!ox.hints.some((h) => h.orderId === o.id), 'other user gets no hint for this order');
rt.close();
ox.close();
