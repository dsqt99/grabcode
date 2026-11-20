import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import type { AuthService } from '../auth/auth.service';
import { orders, refunds } from '../db/schema';
import { OrdersService } from '../orders/orders.service';
import { postTx } from '../payments/ledger.db';
import { coderOf, depositEntries, escrowOf, moveEntries } from '../payments/ledger';
import type { ReposService } from '../repos/repos.service';
import { addOrder, addUser, testDb } from '../test/pglite';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const setup = async () => {
  const db = await testDb();
  const svc = new AdminService(db, {} as ReposService);
  const admin = await addUser(db, ['ADMIN']);
  const customer = await addUser(db, ['CUSTOMER']);
  return { db, svc, admin, customer, ordersSvc: new OrdersService(db) };
};
type Ctx = Awaited<ReturnType<typeof setup>>;

const ago = (interval: string) => sql`now() - ${interval}::interval` as unknown as Date;

/** A paid order nobody took yet (FUNDED), created `createdAgo` before now. */
async function fundedOrder({ db, svc, admin, customer }: Ctx, createdAgo = '0 minutes', ref = 'FT001') {
  const o = await addOrder(db, customer.id, { createdAt: ago(createdAgo) });
  await svc.confirmPayment(admin, o.id, { amountVnd: o.priceVnd, reference: ref });
  return o;
}

const rejects = (p: Promise<unknown>, cls: new (...a: never[]) => Error) => assert.rejects(p, (e) => e instanceof cls);

test('B1 / AC1: auto refund counts 24h from FUNDED, not from order creation', async () => {
  const ctx = await setup();
  const { db, svc } = ctx;
  // Created at T0, paid at T0 + 23h50 (now): must stay on the board until T0 + 47h50.
  const o = await fundedOrder(ctx, '23 hours 50 minutes');
  const [funded] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(funded.status, 'FUNDED');
  assert.ok(funded.fundedAt, 'funding stamps fundedAt');
  assert.deepEqual(await svc.refundStale(24), [], 'just paid: not stale although created 23h50 ago');

  // T0 + 47h40: funded 23h50 ago -> still kept.
  await db.update(orders).set({ createdAt: ago('47 hours 40 minutes'), fundedAt: ago('23 hours 50 minutes') }).where(eq(orders.id, o.id));
  assert.deepEqual(await svc.refundStale(24), []);

  // T0 + 47h50+: funded 24h+ ago -> cancelled and refunded.
  await db.update(orders).set({ fundedAt: ago('24 hours 1 minute') }).where(eq(orders.id, o.id));
  assert.deepEqual(await svc.refundStale(24), [o.id]);
  const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.status, 'CANCELLED');
});

test('B1: the 30 min "no coder yet" attention list also counts from funding', async () => {
  const ctx = await setup();
  const { db, svc } = ctx;
  const o = await fundedOrder(ctx, '2 hours');
  assert.ok(!(await svc.orders()).some((x) => x.id === o.id), 'paid just now: not yet waiting 30 min');
  await db.update(orders).set({ fundedAt: ago('31 minutes') }).where(eq(orders.id, o.id));
  const listed = (await svc.orders()).find((x) => x.id === o.id);
  assert.ok(listed, 'funded 31 min ago, no coder: listed');
  assert.ok(listed.fundedAt);
});

test('B2: an auto refund opens a pending refund with order, amount, customer account and time', async () => {
  const ctx = await setup();
  const { db, svc, customer, ordersSvc } = ctx;
  const o = await fundedOrder(ctx);
  await ordersSvc.setRefundAccount(customer, o.id, { bankName: 'MB Bank', accountNumber: '0123 456 789', accountName: 'NGUYEN VAN A' });
  await db.update(orders).set({ fundedAt: ago('25 hours') }).where(eq(orders.id, o.id));
  await svc.refundStale(24);

  const [r] = await svc.refunds();
  assert.equal(r.orderId, o.id);
  assert.equal(r.amountVnd, o.priceVnd);
  assert.equal(r.status, 'PENDING');
  assert.deepEqual(r.refundAccount, { bankName: 'MB Bank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A' });
  assert.equal(r.customerName, customer.name);
  assert.ok(r.createdAt);

  // The customer's order shows where the money went.
  const dto = await ordersSvc.get(customer, o.id);
  assert.deepEqual(dto.money, { paidVnd: o.priceVnd, heldVnd: 0, releasedVnd: 0, refundedVnd: o.priceVnd });
});

test('B2 / AC3: "Đã chuyển" closes a refund once; a bank reference closes one refund only', async () => {
  const ctx = await setup();
  const { svc, admin } = ctx;
  const a = await fundedOrder(ctx, '0 minutes', 'FT-A');
  const b = await fundedOrder(ctx, '0 minutes', 'FT-B');
  await svc.refund(a.id);
  await svc.refund(b.id);
  const [ra, rb] = await svc.refunds();
  assert.equal(ra.orderId, a.id);

  const paid = await svc.markRefundPaid(admin, ra.id, { reference: ' ft 999 ' });
  assert.equal(paid.status, 'PAID');
  assert.equal(paid.reference, 'FT999');
  assert.ok(paid.paidAt);
  assert.deepEqual((await svc.refunds()).map((r) => r.id), [rb.id], 'paid refund leaves the pending list');

  await rejects(svc.markRefundPaid(admin, ra.id, { reference: 'FT1000' }), ConflictException);
  await rejects(svc.markRefundPaid(admin, rb.id, { reference: 'FT999' }), ConflictException);
  await rejects(svc.markRefundPaid(admin, '00000000-0000-4000-8000-000000000000', { reference: 'FT1' }), NotFoundException);
  assert.equal((await svc.refunds('all')).length, 2);
});

test('B2 / AC2: dispute refund part and suspense refund open refunds; coder payouts do not', async () => {
  const ctx = await setup();
  const { db, svc, admin } = ctx;
  const coder = await addUser(db, ['CODER']);
  const o = await fundedOrder(ctx);
  await db.update(orders).set({ status: 'DISPUTED', coderUserId: coder.id }).where(eq(orders.id, o.id));
  await svc.resolveDispute(o.id, { refundVnd: 1_000_000 });

  await db.transaction((tx) => postTx(tx, 'sepay:1', 'DEPOSIT', null, depositEntries(null, 500_000), { content: 'CK nham GC99' }));
  await svc.resolveSuspense('sepay:1', null);

  // Coder withdrawal: PAYOUT also credits the bank but is not a customer refund.
  await db.transaction((tx) => postTx(tx, 'adjust:wallet', 'ADJUST', null, moveEntries(escrowOf('x'), coderOf(coder.id), 300_000)));
  const p = await svc.requestPayout(coder, { amountVnd: 300_000, bankAccount: 'VCB 0011 TRAN B' });
  await svc.decidePayout(admin, p.id, { approve: true });

  const list = await svc.refunds();
  assert.deepEqual(
    list.map((r) => [r.orderId, r.amountVnd, r.transferContent]),
    [
      [o.id, 1_000_000, null],
      [null, 500_000, 'CK nham GC99'],
    ],
  );
  assert.equal((await db.select().from(refunds)).length, 2);
});

test('a dispute split with nothing refunded opens no refund', async () => {
  const ctx = await setup();
  const { db, svc } = ctx;
  const coder = await addUser(db, ['CODER']);
  const o = await fundedOrder(ctx);
  await db.update(orders).set({ status: 'DISPUTED', coderUserId: coder.id }).where(eq(orders.id, o.id));
  await svc.resolveDispute(o.id, { refundVnd: 0 });
  assert.deepEqual(await svc.refunds(), []);
});

test('P0-10: admin order detail has prompt, brief, refund account, chat and ledger', async () => {
  const ctx = await setup();
  const { db, svc, customer, ordersSvc } = ctx;
  const coder = await addUser(db, ['CODER']);
  const o = await fundedOrder(ctx, '0 minutes', 'FT777');
  await db.update(orders).set({ status: 'DISPUTED', coderUserId: coder.id, disputeReason: 'Link không mở được' }).where(eq(orders.id, o.id));
  await ordersSvc.sendMessage(customer, o.id, 'Bạn kiểm tra giúp mình link M2');
  await ordersSvc.setRefundAccount(customer, o.id, { bankName: 'VCB', accountNumber: '001100', accountName: 'KHACH' });

  const d = await svc.orderDetail(o.id);
  assert.equal(d.order.id, o.id);
  assert.equal(d.order.disputeReason, 'Link không mở được');
  assert.equal(d.prompt, o.prompt);
  assert.equal(d.brief.milestones.length, 3);
  assert.equal(d.refundAccount?.accountNumber, '001100');
  assert.deepEqual(d.messages.map((m) => [m.sender, m.text]), [['CUSTOMER', 'Bạn kiểm tra giúp mình link M2']]);
  assert.equal(d.ledger.length, 1);
  assert.equal(d.ledger[0].kind, 'DEPOSIT');
  assert.equal(d.ledger[0].reference, 'FT777');
  assert.deepEqual(d.ledger[0].entries.find((e) => e.account === escrowOf(o.id))?.amountVnd, o.priceVnd);
  await rejects(svc.orderDetail('GC-404'), NotFoundException);
});

test('P0-10 / AC2: non-admins get 403 on the admin order detail; the order parties cannot read it either', async () => {
  const ctx = await setup();
  const { db, svc, admin, customer } = ctx;
  const coder = await addUser(db, ['CODER']);
  const o = await fundedOrder(ctx);
  const as = (user: unknown) => new AdminController(svc, { requireUser: async () => user } as unknown as AuthService);
  const req = { headers: { cookie: 'gc_session=t' } } as Request;
  await rejects(as(customer).order(req, o.id), ForbiddenException);
  await rejects(as(coder).order(req, o.id), ForbiddenException);
  await rejects(as(customer).refunds(req, {}), ForbiddenException);
  await rejects(as(customer).refundPaid(req, '00000000-0000-4000-8000-000000000000', { reference: 'FT1' }), ForbiddenException);
  assert.equal((await as(admin).order(req, o.id)).order.id, o.id);
});

test('refund account: customer only, never the coder', async () => {
  const ctx = await setup();
  const { db, customer, ordersSvc } = ctx;
  const coder = await addUser(db, ['CODER']);
  const o = await fundedOrder(ctx);
  await db.update(orders).set({ coderUserId: coder.id }).where(eq(orders.id, o.id));
  assert.equal(await ordersSvc.refundAccount(customer, o.id), null);
  await rejects(ordersSvc.refundAccount(coder, o.id), NotFoundException);
  await rejects(ordersSvc.setRefundAccount(coder, o.id, { bankName: 'MB', accountNumber: '123456', accountName: 'X Y' }), NotFoundException);
});
