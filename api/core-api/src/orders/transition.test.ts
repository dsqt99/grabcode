import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AIBrief } from '@grabcode/contracts';
import { ORDER_TRANSITIONS, OrderStatusSchema, type OrderStatus } from '@grabcode/contracts/schemas';
import { completeMilestone, isDenied, planTransition } from './transition';

const CUST = { id: 'c', roles: ['CUSTOMER'] };
const CODER = { id: 'k', roles: ['CODER'] };
const OTHER = { id: 'x', roles: ['CODER', 'CUSTOMER'] };
const brief = (...st: ('PENDING' | 'IN_PROGRESS' | 'COMPLETED')[]): AIBrief => ({
  title: 't', scopeSummary: '', features: [], inScope: [], outOfScope: [], acceptanceCriteria: [], claudeMdContent: '',
  milestones: st.map((status, i) => ({ id: `M${i + 1}`, title: '', description: '', weightPercent: 50, status })),
});
const order = (status: OrderStatus, coderUserId: string | null = 'k', b = brief('COMPLETED', 'COMPLETED')) =>
  ({ status, customerUserId: 'c', coderUserId, brief: b });

test('happy path: each edge allowed for the right actor', () => {
  assert.deepEqual(planTransition(order('IN_PROGRESS'), CODER, 'DELIVERED'), { coderUserId: 'k' });
  for (const to of ['ACCEPTED', 'DISPUTED', 'IN_PROGRESS'] as const) {
    assert.deepEqual(planTransition(order('DELIVERED'), CUST, to), { coderUserId: 'k' });
  }
});

test('every edge not in the table is 409, SYSTEM edges are not callable', () => {
  for (const from of OrderStatusSchema.options) {
    for (const to of OrderStatusSchema.options) {
      const actor = ORDER_TRANSITIONS[from][to];
      if (actor && actor !== 'SYSTEM') continue;
      const r = planTransition(order(from), CUST, to);
      assert.ok(isDenied(r) && r.denied === 409, `${from} -> ${to}`);
    }
  }
});

test('wrong actor is 403', () => {
  assert.equal((planTransition(order('IN_PROGRESS'), OTHER, 'DELIVERED') as { denied: number }).denied, 403);
  assert.equal((planTransition(order('DELIVERED'), CODER, 'ACCEPTED') as { denied: number }).denied, 403);
});

test('deliver needs every milestone done', () => {
  const r = planTransition(order('IN_PROGRESS', 'k', brief('COMPLETED', 'IN_PROGRESS')), CODER, 'DELIVERED');
  assert.ok(isDenied(r) && r.denied === 409);
});

test('milestones complete in order and start the next one', () => {
  const o = order('IN_PROGRESS', 'k', brief('IN_PROGRESS', 'PENDING'));
  const out = completeMilestone(o, CODER, 'M1', 'abc1234', 'now');
  assert.ok(!isDenied(out));
  assert.deepEqual(out.milestones.map((m) => m.status), ['COMPLETED', 'IN_PROGRESS']);
  assert.equal(out.milestones[0].commitHash, 'abc1234');
  assert.ok(isDenied(completeMilestone(o, CODER, 'M2', null, 'now')));
  assert.ok(isDenied(completeMilestone(o, OTHER, 'M1', null, 'now')));
  assert.ok(isDenied(completeMilestone(order('DELIVERED', 'k', brief('PENDING')), CODER, 'M1', null, 'now')));
});
