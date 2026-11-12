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
