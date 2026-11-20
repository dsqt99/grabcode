import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminNoticeFor, type AdminFacts } from './adminMessages';
import { sendTelegram, telegramConfig } from './telegram';

const base: AdminFacts = {
  orderId: 'GC-1006',
  title: 'Landing page bán khoá học',
  amountVnd: 2_500_000,
  priceQuoted: false,
  partyName: 'Chị Lan',
  partyPhone: '0912345678',
  partyEmail: 'lan@example.vn',
  adminUrl: 'https://grabcode.vn/admin',
};

test('each admin notice has order id, amount, customer name + phone and the admin link', () => {
  const created = adminNoticeFor('order.created', base);
  assert.equal(created, '🆕 Đơn mới GC-1006 — cần báo giá\nLanding page bán khoá học\nGiá từ: 2.500.000 đ\nKhách: Chị Lan · SĐT: 0912345678 · lan@example.vn\nAdmin: https://grabcode.vn/admin');
  const reported = adminNoticeFor('payment.reported', { ...base, amountVnd: 3_000_000, priceQuoted: true });
  assert.match(reported, /GC-1006/);
  assert.match(reported, /3\.000\.000 đ/);
  assert.match(reported, /Chị Lan · SĐT: 0912345678/);
  const disputed = adminNoticeFor('order.disputed', { ...base, priceQuoted: true, reason: 'Thiếu trang quản trị' });
  assert.match(disputed, /Tranh chấp đơn GC-1006[\s\S]*Lý do: Thiếu trang quản trị[\s\S]*Admin: https/);
  const payout = adminNoticeFor('payout.requested', { amountVnd: 300_000, partyName: 'An', partyPhone: null, partyEmail: null, bankAccount: 'MB 0123', adminUrl: 'https://grabcode.vn/admin' });
  assert.equal(payout, '🏦 Yêu cầu rút tiền 300.000 đ\nFreelancer: An · SĐT: chưa có\nTài khoản: MB 0123\nAdmin: https://grabcode.vn/admin');
});

test('Telegram is off unless both token and chat id are set', () => {
  assert.equal(telegramConfig({}), null);
  assert.equal(telegramConfig({ TELEGRAM_BOT_TOKEN: 't' }), null);
  assert.deepEqual(telegramConfig({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_ADMIN_CHAT_ID: '-100' }), { token: 't', chatId: '-100' });
});

test('sendTelegram: 5xx/429 throw (retry), other 4xx is logged only', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fake = (status: number) =>
    (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response('{}', { status });
    }) as unknown as typeof fetch;
  const cfg = { token: 'T0K', chatId: '-100' };
  await sendTelegram(cfg, 'xin chào', fake(200));
  assert.deepEqual(calls[0], { url: 'https://api.telegram.org/botT0K/sendMessage', body: { chat_id: '-100', text: 'xin chào', disable_web_page_preview: true } });
  await assert.rejects(sendTelegram(cfg, 'x', fake(502)));
  await assert.rejects(sendTelegram(cfg, 'x', fake(429)));
  await sendTelegram(cfg, 'x', fake(400));
});
