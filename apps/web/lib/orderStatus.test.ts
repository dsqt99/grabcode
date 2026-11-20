import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Order } from '@grabcode/contracts';
import { customerTodo, milestoneAmount, orderTab, paysOnApproval, statusInput, statusView, type ServerStatus, type StatusInput } from './orderStatus';

const ms = (...st: Order['brief']['milestones'][number]['status'][]) =>
  st.map((status, i) => ({ id: `M${i + 1}`, title: '', description: '', weightPercent: [20, 50, 30][i], status }));

const input = (status: ServerStatus, patch: Partial<StatusInput> = {}): StatusInput => ({
  status,
  priceVnd: 2_900_000,
  priceQuoted: true,
  money: { paidVnd: 2_900_000, heldVnd: 2_900_000, releasedVnd: 0, refundedVnd: 0 },
  milestones: ms('PENDING', 'PENDING', 'PENDING'),
  coderName: 'An',
  ...patch,
});

const row = (i: StatusInput) => {
  const v = statusView(i);
  return [v.label, v.tone, v.step, v.money, [v.canReview && 'review', v.canAccept && 'accept', v.canDispute && 'dispute'].filter(Boolean).join(',')];
};

test('Màn B status table: chip, money line, step and actions per server status', () => {
  const unpaid = { paidVnd: 0, heldVnd: 0, releasedVnd: 0, refundedVnd: 0 };
  const half = { paidVnd: 2_900_000, heldVnd: 2_320_000, releasedVnd: 580_000, refundedVnd: 0 };
  assert.deepEqual(row(input('DRAFT', { money: unpaid })), ['Chờ thanh toán', 'warn', 0, 'Chưa thanh toán', '']);
  assert.deepEqual(row(input('FUNDED')), ['Đang tìm freelancer', 'info', 1, 'Đã nhận 2.900.000 đ · đang giữ tại GrabCode', '']);
  assert.deepEqual(row(input('DISPATCHED')), row(input('FUNDED')));
  assert.deepEqual(row(input('IN_PROGRESS', { money: half, milestones: ms('COMPLETED', 'IN_PROGRESS', 'PENDING') })), [
    'Đang làm',
    'brand',
    2,
    'Đã giải ngân 580.000 đ / tổng 2.900.000 đ · đang giữ 2.320.000 đ',
    'review,dispute',
  ]);
  assert.deepEqual(row(input('IN_PROGRESS', { money: half, milestones: ms('COMPLETED', 'SUBMITTED', 'PENDING') })).slice(0, 2), ['Chờ bạn duyệt mốc', 'warn']);
  // Q2: the last milestone (30%) is still held when delivered.
  assert.deepEqual(row(input('DELIVERED', { money: { ...half, heldVnd: 870_000, releasedVnd: 2_030_000 } })), [
    'Chờ bạn nghiệm thu',
    'warn',
    3,
    'Đã giải ngân 2.030.000 đ / tổng 2.900.000 đ · đang giữ 870.000 đ',
    'accept,dispute',
  ]);
  assert.deepEqual(row(input('ACCEPTED', { money: { ...half, heldVnd: 0, releasedVnd: 2_900_000 } })), ['Hoàn tất', 'ok', 4, 'Đã giải ngân 2.900.000 đ / tổng 2.900.000 đ', '']);
  assert.deepEqual(row(input('DISPUTED', { money: half })), ['Đang tranh chấp', 'danger', null, 'Tạm giữ 2.320.000 đ · đã giải ngân 580.000 đ / tổng 2.900.000 đ', '']);
  assert.deepEqual(row(input('RESOLVED', { money: { paidVnd: 2_900_000, heldVnd: 0, releasedVnd: 1_900_000, refundedVnd: 1_000_000 } })), [
    'Đã xử lý tranh chấp',
    'neutral',
    null,
    'Hoàn bạn 1.000.000 đ',
    '',
  ]);
  assert.deepEqual(row(input('CANCELLED', { money: { paidVnd: 2_900_000, heldVnd: 0, releasedVnd: 0, refundedVnd: 2_900_000 } })), [
    'Đã huỷ',
    'neutral',
    null,
    'Hoàn 2.900.000 đ',
    '',
  ]);
  assert.deepEqual(row(input('CANCELLED', { money: unpaid })).slice(0, 4), ['Đã huỷ', 'neutral', null, 'Không thu tiền']);
});

test('cancelled, resolved and disputed orders never say the money is held safely or that a coder is being matched', () => {
  for (const status of ['DISPUTED', 'CANCELLED', 'RESOLVED'] as const) {
    const v = statusView(input(status, { money: { paidVnd: 2_900_000, heldVnd: 0, releasedVnd: 2_900_000, refundedVnd: 0 } }));
    const text = `${v.label} ${v.description} ${v.money}`;
    assert.doesNotMatch(text, /giữ an toàn|ghép Coder|Đang tìm/);
    assert.equal(v.step, null);
    assert.equal(v.canAccept, false);
  }
});

test('dispute banner tells the real amount still held, including 0 đ', () => {
  const zero = statusView(input('DISPUTED', { money: { paidVnd: 2_900_000, heldVnd: 0, releasedVnd: 2_900_000, refundedVnd: 0 } }));
  assert.match(zero.description, /Không còn tiền tạm giữ \(0 đ\)/);
  const some = statusView(input('DISPUTED', { money: { paidVnd: 2_900_000, heldVnd: 870_000, releasedVnd: 2_030_000, refundedVnd: 0 } }));
  assert.match(some.description, /870\.000 đ còn lại được tạm giữ/);
});

test('DRAFT: no accept / review action, stepper on "Thanh toán"', () => {
  const v = statusView(input('DRAFT', { money: { paidVnd: 0, heldVnd: 0, releasedVnd: 0, refundedVnd: 0 } }));
  assert.equal(v.step, 0);
  assert.deepEqual([v.canAccept, v.canReview, v.canDispute], [false, false, false]);
});

test('mock orders map onto server statuses; milestone amount matches the server split', () => {
  const order = { status: 'BUILDING', priceVnd: 2_900_000, brief: { milestones: ms('COMPLETED', 'IN_PROGRESS', 'PENDING') } } as unknown as Order;
  const i = statusInput(order);
  assert.equal(i.status, 'IN_PROGRESS');
  assert.deepEqual(i.money, { paidVnd: 2_900_000, heldVnd: 2_320_000, releasedVnd: 580_000, refundedVnd: 0 });
  assert.deepEqual(['M1', 'M2', 'M3'].map((id) => milestoneAmount(order, id)), [580_000, 1_450_000, 870_000]);
});

test('Màn D: what the customer must do and which tab each order lands in', () => {
  const todo = (status: ServerStatus, milestones = ms('PENDING', 'PENDING', 'PENDING'), priceQuoted = true) =>
    [customerTodo({ status, priceQuoted, milestones }), orderTab({ status, priceQuoted, milestones })];
  assert.deepEqual(todo('DRAFT'), ['Chờ bạn chuyển khoản', 'action']);
  assert.deepEqual(todo('DRAFT', undefined, false), [null, 'active'], 'waiting for the quote is not on the customer');
  assert.deepEqual(todo('IN_PROGRESS', ms('COMPLETED', 'SUBMITTED', 'PENDING')), ['Chờ bạn duyệt M2', 'action']);
  assert.deepEqual(todo('DELIVERED', ms('COMPLETED', 'COMPLETED', 'COMPLETED')), ['Chờ bạn nghiệm thu', 'action']);
  assert.deepEqual(todo('FUNDED'), [null, 'active']);
  assert.deepEqual(todo('DISPATCHED'), [null, 'active']);
  assert.deepEqual(todo('IN_PROGRESS', ms('COMPLETED', 'IN_PROGRESS', 'PENDING')), [null, 'active']);
  assert.deepEqual(todo('DISPUTED'), [null, 'active']);
  assert.deepEqual(todo('ACCEPTED'), [null, 'done']);
  assert.deepEqual(todo('RESOLVED'), [null, 'done']);
  assert.deepEqual(todo('CANCELLED'), [null, 'cancelled']);
});

test('P0-11: waiting for a freelancer says the money arrived and the 24h refund', () => {
  assert.match(statusView(input('FUNDED')).description, /^Đã nhận tiền, đang chờ freelancer nhận đơn\. Không ai nhận trong 24 giờ thì GrabCode hoàn tiền\.$/);
});

test('P0-7: an unquoted DRAFT waits for the quote (no payment step text), a quoted one asks for the transfer', () => {
  const unpaid = { paidVnd: 0, heldVnd: 0, releasedVnd: 0, refundedVnd: 0 };
  const waiting = statusView(input('DRAFT', { priceQuoted: false, priceVnd: 2_500_000, money: unpaid }));
  assert.deepEqual([waiting.label, waiting.money, waiting.step], ['Chờ báo giá', 'Giá từ 2.500.000 đ · chưa thanh toán', 0]);
  assert.match(waiting.description, /chỉ chuyển khoản sau khi có giá chốt/);
  assert.equal(statusView(input('DRAFT', { money: unpaid })).label, 'Chờ thanh toán');
});

test('Q2: submitted last milestone says its money is paid on acceptance; mock money keeps the last share held', () => {
  const v = statusView(input('IN_PROGRESS', { milestones: ms('COMPLETED', 'COMPLETED', 'SUBMITTED') }));
  assert.match(v.description, /mốc cuối M3.*trả khi bạn nghiệm thu cả đơn/);
  const order = { status: 'QA_TESTING', priceVnd: 2_900_000, brief: { milestones: ms('COMPLETED', 'COMPLETED', 'COMPLETED') } } as unknown as Order;
  assert.deepEqual(statusInput(order).money, { paidVnd: 2_900_000, heldVnd: 870_000, releasedVnd: 2_030_000, refundedVnd: 0 });
  assert.deepEqual(['M1', 'M2', 'M3'].map((id) => paysOnApproval(order, id)), [true, true, false]);
});
