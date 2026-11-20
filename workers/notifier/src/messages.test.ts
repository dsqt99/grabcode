import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noticesFor } from './messages';

const C = '11111111-1111-4111-8111-111111111111';
const K = '22222222-2222-4222-8222-222222222222';
const ev = (type: string, from: string | null, coder: string | null = K) =>
  ({ event_id: 'e', type, occurred_at: '', data: { orderId: 'GC-1', status: 'X', from, customerUserId: C, coderUserId: coder } }) as never;

test('offer goes to the wave coders', () => {
  const [n] = noticesFor({ event_id: 'e', type: 'dispatch.offered', occurred_at: '', data: { orderId: 'GC-1', wave: 1, coderUserIds: [K] } });
  assert.deepEqual(n.userIds, [K]);
  assert.equal(n.url, '/coder');
});

test('order events pick the right side', () => {
  assert.deepEqual(noticesFor(ev('order.delivered', 'IN_PROGRESS'))[0].userIds, [C]);
  assert.deepEqual(noticesFor(ev('order.started', 'DISPATCHED'))[0].userIds, [C]);
  assert.deepEqual(noticesFor(ev('order.started', 'DELIVERED'))[0].userIds, [K]);
  assert.deepEqual(noticesFor(ev('order.resolved', 'DISPUTED'))[0].userIds, [C, K]);
  assert.deepEqual(noticesFor(ev('order.accepted', 'DELIVERED', null)), []);
  assert.deepEqual(noticesFor(ev('order.cancelled', 'DRAFT')), []);
  assert.deepEqual(noticesFor(ev('order.created', null)), []);
});

test('chat goes to the other party, coder to the coder app', () => {
  const chat = (toCustomerUserId: string | null, toCoderUserId: string | null) =>
    noticesFor({ event_id: 'e', type: 'chat.posted', occurred_at: '', data: { orderId: 'GC-1', senderName: 'An', toCustomerUserId, toCoderUserId, preview: 'hi' } });
  assert.deepEqual(chat(null, K).map((n) => [n.userIds, n.url, n.body]), [[[K], '/coder', 'hi']]);
  assert.deepEqual(chat(C, null).map((n) => [n.userIds, n.url]), [[[C], '/order/GC-1']]);
});

test('P0-2: submitted milestone asks the customer to review; rejected / approved go to the coder (approved with the wallet amount)', () => {
  const ms = (type: string, extra: Record<string, unknown> = {}) =>
    noticesFor({
      event_id: 'e',
      type,
      occurred_at: '',
      data: { orderId: 'GC-1', milestoneId: 'M2', customerUserId: C, coderUserId: K, commitHash: null, note: null, releasedVnd: 0, payoutVnd: 0, ...extra },
    } as never);
  const [submitted] = ms('milestone.submitted');
  assert.deepEqual([submitted.userIds, submitted.title, submitted.url], [[C], 'Mốc M2 chờ bạn duyệt', '/order/GC-1']);
  const [rejected] = ms('milestone.rejected', { note: 'Nút đặt bàn lỗi' });
  assert.deepEqual([rejected.userIds, rejected.url], [[K], '/coder']);
  assert.match(rejected.body, /Nút đặt bàn lỗi/);
  const [approved] = ms('milestone.approved', { releasedVnd: 1_450_000, payoutVnd: 1_015_000 });
  assert.deepEqual([approved.userIds, approved.url], [[K], '/coder']);
  assert.match(approved.body, /\+1\.015\.000 đ vào ví/);
});
