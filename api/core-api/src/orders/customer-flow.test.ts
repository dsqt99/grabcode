import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { OrderCreateSchema, type MilestoneEvent, type PaymentReportedEvent } from '@grabcode/contracts/schemas';
import { AdminService } from '../admin/admin.service';
import { orders, outbox, users } from '../db/schema';
import { PaymentsService } from '../payments/payments.service';
import type { ReposService } from '../repos/repos.service';
import { addOrder, addUser, brief, testDb } from '../test/pglite';
import { OrdersService } from './orders.service';

const setup = async () => {
  const db = await testDb();
  const customer = await addUser(db, ['CUSTOMER']);
  return { db, customer, svc: new OrdersService(db), payments: new PaymentsService(db), admin: new AdminService(db, {} as ReposService) };
};
const input = (extra: Record<string, unknown> = {}) => OrderCreateSchema.parse({ prompt: 'Web đặt bàn', menuItem: 'DEMO_LANDING', brief: brief(), acceptTerms: true, ...extra });
const userRow = async (db: Awaited<ReturnType<typeof testDb>>, id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];
const events = async (db: Awaited<ReturnType<typeof testDb>>, subject: string) =>
  (await db.select().from(outbox).where(eq(outbox.subject, subject))).map((r) => r.payload);

test('P0-5: the first order needs a valid Vietnamese mobile; it is saved normalized and reused', async () => {
  const { db, customer, svc, admin } = await setup();
  await assert.rejects(svc.create(customer, input()), (e) => e instanceof BadRequestException);
  assert.throws(() => input({ phone: '12345' }), 'not a Vietnamese mobile');
  assert.throws(() => input({ phone: '0212345678' }), 'landline prefix');
  assert.equal(input({ phone: '+84 912 345 678' }).phone, '0912345678');

  const o = await svc.create(customer, input({ phone: '+84 912.345.678' }));
  const me = await userRow(db, customer.id);
  assert.equal(me.phone, '0912345678');
  // Next order: the profile phone is enough.
  await svc.create(me, input());
  const listed = (await admin.orders(o.id))[0];
  assert.equal(listed.customerPhone, '0912345678', 'admin sees the phone on the order');
});

test('P0-5: a profile phone that is not a VN mobile still asks for one', async () => {
  const { db, customer, svc } = await setup();
  await db.update(users).set({ phone: '+1 555 0100' }).where(eq(users.id, customer.id));
  await assert.rejects(svc.create(await userRow(db, customer.id), input()), (e) => e instanceof BadRequestException);
});

test('P0-9: an order needs the terms ticked', () => {
  assert.throws(() => input({ acceptTerms: false, phone: '0912345678' }));
  assert.throws(() => OrderCreateSchema.parse({ prompt: 'x', menuItem: 'DEMO_LANDING', brief: brief(), phone: '0912345678' }));
});

test('P0-4: "Tôi đã chuyển khoản" stamps the order and emits payment.reported once', async () => {
  const { db, customer, payments, admin } = await setup();
  const o = await addOrder(db, customer.id);
  const before = await payments.instructions(customer, o.id);
  assert.equal(before.reportedAt, null);

  const after = await payments.reportTransfer(customer, o.id);
  assert.ok(after.reportedAt);
  await payments.reportTransfer(customer, o.id); // double tap
  const sent = (await events(db, 'payment.reported')) as PaymentReportedEvent[];
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].data, { orderId: o.id, customerUserId: customer.id, dueVnd: o.priceVnd, content: o.id.replace('-', '') });
  assert.ok((await admin.orders(o.id))[0].paymentReportedAt, 'admin sees the report');

  // Not the customer's order: 404; already funded: 409.
  const other = await addUser(db, ['CUSTOMER'], 'other');
  await assert.rejects(payments.reportTransfer(other, o.id));
  await db.update(orders).set({ status: 'FUNDED' }).where(eq(orders.id, o.id));
  await assert.rejects(payments.reportTransfer(customer, o.id), (e) => e instanceof ConflictException);
});

test('P0-2: milestone events name the customer and coder; approval carries the coder payout', async () => {
  const { db, customer, svc, admin } = await setup();
  const coder = await addUser(db, ['CODER']);
  const o = await addOrder(db, customer.id);
  await admin.confirmPayment(await addUser(db, ['ADMIN']), o.id, { amountVnd: o.priceVnd, reference: 'FT1' });
  const b = brief();
  b.milestones[0].status = 'IN_PROGRESS';
  await db.update(orders).set({ status: 'IN_PROGRESS', coderUserId: coder.id, brief: b }).where(eq(orders.id, o.id));

  await svc.submitMilestone(coder, o.id, 'M1', { commitHash: null, deliveryUrl: 'https://demo.example.vn', note: null });
  await svc.reviewMilestone(customer, o.id, 'M1', false, 'Nút đặt bàn không bấm được');
  await svc.submitMilestone(coder, o.id, 'M1', { commitHash: null, deliveryUrl: 'https://demo.example.vn/v2', note: null });
  await svc.reviewMilestone(customer, o.id, 'M1', true, null);

  const parties = { customerUserId: customer.id, coderUserId: coder.id };
  const [submitted] = (await events(db, 'milestone.submitted')) as MilestoneEvent[];
  assert.deepEqual({ ...submitted.data, commitHash: null }, { ...parties, orderId: o.id, milestoneId: 'M1', commitHash: null, note: null, releasedVnd: 0, payoutVnd: 0 });
  const [rejected] = (await events(db, 'milestone.rejected')) as MilestoneEvent[];
  assert.equal(rejected.data.coderUserId, coder.id);
  assert.equal(rejected.data.note, 'Nút đặt bàn không bấm được');
  const [approved] = (await events(db, 'milestone.approved')) as MilestoneEvent[];
  // M1 = 20%: 580.000 đ leaves escrow, 20% of the 2.030.000 đ payout (406.000 đ) goes to the wallet.
  assert.equal(approved.data.releasedVnd, 580_000);
  assert.equal(approved.data.payoutVnd, 406_000);
});
