import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AIBrief } from '@grabcode/contracts';
import { ORDER_TRANSITIONS, OrderStatusSchema, OrderTransitionSchema, releasesOnApproval, type OrderStatus } from '@grabcode/contracts/schemas';
import { freshBrief, isDenied, planTransition, reopenForRevision, reviewMilestone, submitMilestone } from './transition';

const NONE = { commitHash: null, deliveryUrl: null, note: null };
const CUST = { id: 'c', roles: ['CUSTOMER'] };
const CODER = { id: 'k', roles: ['CODER'] };
const OTHER = { id: 'x', roles: ['CODER', 'CUSTOMER'] };
const brief = (...st: AIBrief['milestones'][number]['status'][]): AIBrief => ({
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
  assert.deepEqual(planTransition(order('IN_PROGRESS'), CUST, 'DISPUTED'), { coderUserId: 'k' });
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

test('submit -> reject -> resubmit -> approve, in order, starting the next milestone', () => {
  const o = order('IN_PROGRESS', 'k', brief('IN_PROGRESS', 'PENDING'));
  assert.ok(isDenied(submitMilestone(o, CODER, 'M2', NONE, 't')));
  assert.ok(isDenied(submitMilestone(o, OTHER, 'M1', NONE, 't')));
  const sub = submitMilestone(o, CODER, 'M1', { commitHash: 'abc1234', deliveryUrl: 'https://demo.example.vn', note: 'done' }, 't') as AIBrief;
  assert.deepEqual([sub.milestones[0].status, sub.milestones[0].commitHash, sub.milestones[0].deliveryUrl, sub.milestones[0].note], ['SUBMITTED', 'abc1234', 'https://demo.example.vn', 'done']);
  const o2 = { ...o, brief: sub };
  assert.ok(isDenied(submitMilestone(o2, CODER, 'M1', NONE, 't')), 'no double submit');
  assert.ok(isDenied(reviewMilestone(o2, CODER, 'M1', true, null, 't')), 'coder cannot approve');
  assert.ok(isDenied(reviewMilestone({ ...o2, status: 'DISPUTED' }, CUST, 'M1', true, null, 't')), 'frozen while disputed');
  const rej = reviewMilestone(o2, CUST, 'M1', false, 'fix header', 't') as { brief: AIBrief };
  assert.deepEqual([rej.brief.milestones[0].status, rej.brief.milestones[0].note], ['IN_PROGRESS', 'fix header']);
  const ok = reviewMilestone(o2, CUST, 'M1', true, null, 't') as { brief: AIBrief; index: number };
  assert.deepEqual([ok.index, ...ok.brief.milestones.map((m) => m.status)], [0, 'COMPLETED', 'IN_PROGRESS']);
  assert.ok(isDenied(reviewMilestone({ ...o, brief: ok.brief }, CUST, 'M1', true, null, 't')), 'no double approve');
  const qa = (status: 'FAILED' | 'ERROR') => ({ ...o2, brief: { ...sub, milestones: sub.milestones.map((m, i) => (i ? m : { ...m, qa: { status, commitHash: 'abc1234', checks: [] } })) } });
  assert.ok(isDenied(reviewMilestone(qa('FAILED'), CUST, 'M1', true, null, 't')), 'QA FAILED blocks approve');
  assert.ok(!isDenied(reviewMilestone(qa('FAILED'), CUST, 'M1', false, 'fix QA', 't')), 'QA FAILED still allows request changes');
  assert.ok(!isDenied(reviewMilestone(qa('ERROR'), CUST, 'M1', true, null, 't')), 'QA ERROR does not block');
});

test('a PENDING first milestone (order just accepted) can be submitted', () => {
  assert.ok(!isDenied(submitMilestone(order('IN_PROGRESS', 'k', brief('PENDING')), CODER, 'M1', NONE, 't')));
  assert.ok(isDenied(submitMilestone(order('DELIVERED', 'k', brief('PENDING')), CODER, 'M1', NONE, 't')));
});

test('new order brief: server-assigned unique milestone ids, progress reset', () => {
  // A customer-built brief with duplicate ids would let one approval's release key swallow the next milestone's payout.
  const dup: AIBrief = {
    ...brief('COMPLETED', 'SUBMITTED'),
    milestones: [
      { id: 'a', title: '', description: '', weightPercent: 1, status: 'COMPLETED', commitHash: 'abc1234', deliveryUrl: 'https://x.vn', note: 'n' },
      { id: 'a', title: '', description: '', weightPercent: 99, status: 'SUBMITTED' },
    ],
  };
  const f = freshBrief(dup);
  assert.deepEqual(f.milestones.map((m) => [m.id, m.status, m.weightPercent]), [['M1', 'PENDING', 1], ['M2', 'PENDING', 99]]);
  assert.ok(f.milestones.every((m) => !m.commitHash && !m.deliveryUrl && !m.note && !m.completedAt));
});

test('Q2: every milestone pays on approval except the last one (held until ACCEPTED)', () => {
  assert.deepEqual([0, 1, 2].map((i) => releasesOnApproval(i, 3)), [true, true, false]);
  assert.equal(releasesOnApproval(0, 1), false, 'a single-milestone order pays only on acceptance');
});

test('B3: revision note is required (10+ chars) and reopens the last milestone for a new hand-in', () => {
  assert.ok(!OrderTransitionSchema.safeParse({ status: 'IN_PROGRESS' }).success);
  assert.ok(!OrderTransitionSchema.safeParse({ status: 'IN_PROGRESS', reason: '  ngắn quá  ' }).success);
  assert.ok(OrderTransitionSchema.safeParse({ status: 'IN_PROGRESS', reason: 'Sửa màu nút đặt bàn' }).success);
  const done: AIBrief = { ...brief('COMPLETED', 'COMPLETED'), milestones: brief('COMPLETED', 'COMPLETED').milestones.map((m) => ({ ...m, completedAt: 't', deliveryUrl: 'https://v1.vn' })) };
  const b = reopenForRevision(done, 'Sửa màu nút đặt bàn');
  assert.deepEqual(b.milestones.map((m) => [m.status, m.note ?? null, m.completedAt ?? null]), [['COMPLETED', null, 't'], ['IN_PROGRESS', 'Sửa màu nút đặt bàn', null]]);
  const o = { ...order('IN_PROGRESS', 'k', b) };
  const sub = submitMilestone(o, CODER, 'M2', { commitHash: null, deliveryUrl: 'https://v2.vn', note: 'đã sửa' }, 't2');
  assert.ok(!isDenied(sub), 'no more 409 "Milestones must be submitted in order"');
  assert.deepEqual([(sub as AIBrief).milestones[1].status, (sub as AIBrief).milestones[1].deliveryUrl], ['SUBMITTED', 'https://v2.vn']);
});
