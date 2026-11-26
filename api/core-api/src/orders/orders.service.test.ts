import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { MAX_ORDER_VND, MENU, OrderCreateSchema, OrderQuoteSchema, SUBJECTS, payoutOf } from '@grabcode/contracts/schemas';
import { orders, outbox } from '../db/schema';
import { AdminService } from '../admin/admin.service';
import { PaymentsService } from '../payments/payments.service';
import { balanceOf, postTx } from '../payments/ledger.db';
import { coderOf, depositEntries, escrowOf } from '../payments/ledger';
import type { ReposService } from '../repos/repos.service';
import { addOrder, addUser, brief, testDb } from '../test/pglite';
import { OrdersService } from './orders.service';

const setup = async () => {
  const db = await testDb();
  const customer = await addUser(db, ['CUSTOMER']);
  const coder = await addUser(db, ['CODER']);
  const admin = await addUser(db, ['ADMIN']);
  return { db, customer, coder, admin, svc: new OrdersService(db), adminSvc: new AdminService(db, {} as ReposService), payments: new PaymentsService(db) };
};
type Ctx = Awaited<ReturnType<typeof setup>>;

const rejects = (p: Promise<unknown>, cls: new (...a: never[]) => Error) => assert.rejects(p, (e) => e instanceof cls);
const link = (n: number) => ({ commitHash: null, deliveryUrl: `https://demo.example.vn/v${n}`, note: null });

/** Paid order taken by the coder (2.900.000 đ, weights 20/50/30, payout 2.030.000 đ). */
async function inProgress({ db, customer, coder }: Ctx) {
  const o = await addOrder(db, customer.id, { status: 'IN_PROGRESS', coderUserId: coder.id, brief: brief([20, 50, 30]) });
  await db.transaction((tx) => postTx(tx, `dev:${o.id}`, 'DEPOSIT', o.id, depositEntries(o.id, o.priceVnd)).then(() => undefined));
  return o;
}

/** Coder hands in and the customer approves every milestone; returns escrow after each approval. */
async function approveAll(ctx: Ctx, id: string) {
  const { db, svc, customer, coder } = ctx;
  const escrow: number[] = [];
  for (const m of ['M1', 'M2', 'M3']) {
    await svc.submitMilestone(coder, id, m, link(1));
    await svc.reviewMilestone(customer, id, m, true, null);
    escrow.push(await balanceOf(db, escrowOf(id)));
  }
  return escrow;
}

test('Q2: the last milestone (30%) stays in escrow until the customer accepts the whole order', async () => {
  const ctx = await setup();
  const { db, svc, customer, coder } = ctx;
  const o = await inProgress(ctx);
  // M1 (20%) and M2 (50%) pay on approval; M3 (30%) does not.
  assert.deepEqual(await approveAll(ctx, o.id), [2_320_000, 870_000, 870_000]);
  assert.equal(await balanceOf(db, coderOf(coder.id)), 406_000 + 1_015_000);
  const delivered = await svc.transition(coder, o.id, 'DELIVERED');
  assert.deepEqual(delivered.money, { paidVnd: 2_900_000, heldVnd: 870_000, releasedVnd: 2_030_000, refundedVnd: 0 });

  const accepted = await svc.transition(customer, o.id, 'ACCEPTED');
  assert.equal(accepted.money.heldVnd, 0);
  assert.equal(accepted.money.releasedVnd, 2_900_000);
  assert.equal(await balanceOf(db, coderOf(coder.id)), o.payoutVnd, 'coder gets the whole payout only after acceptance');
});

test('Q2: a milestone.approved event for the last milestone reports 0 released', async () => {
  const ctx = await setup();
  const o = await inProgress(ctx);
  await approveAll(ctx, o.id);
  const events = await ctx.db.select().from(outbox).where(eq(outbox.subject, SUBJECTS.MILESTONE_APPROVED));
  assert.deepEqual(
    events.map((e) => (e.payload as { data: { milestoneId: string; releasedVnd: number } }).data).map((d) => [d.milestoneId, d.releasedVnd]),
    [['M1', 580_000], ['M2', 1_450_000], ['M3', 0]],
  );
});

test('B3: revision after delivery needs a note, reopens the last milestone, and the coder can hand in again', async () => {
  const ctx = await setup();
  const { db, svc, customer, coder } = ctx;
  const o = await inProgress(ctx);
  await approveAll(ctx, o.id);
  await svc.transition(coder, o.id, 'DELIVERED');

  await rejects(svc.transition(customer, o.id, 'IN_PROGRESS'), BadRequestException);
  await rejects(svc.transition(customer, o.id, 'IN_PROGRESS', ' sửa đi   '), BadRequestException);
  const revised = await svc.transition(customer, o.id, 'IN_PROGRESS', 'Nút đặt bàn không bấm được trên iPhone');
  assert.equal(revised.status, 'IN_PROGRESS');
  const m3 = revised.brief.milestones[2];
  assert.deepEqual([m3.status, m3.note, m3.completedAt], ['IN_PROGRESS', 'Nút đặt bàn không bấm được trên iPhone', undefined]);
  assert.deepEqual(revised.brief.milestones.slice(0, 2).map((m) => m.status), ['COMPLETED', 'COMPLETED']);

  // Before: 409 "Milestones must be submitted in order". Now the coder resubmits M3 with a new link + note.
  const resubmitted = await svc.submitMilestone(coder, o.id, 'M3', { commitHash: null, deliveryUrl: 'https://demo.example.vn/v2', note: 'Đã sửa nút đặt bàn' });
  assert.deepEqual([resubmitted.brief.milestones[2].status, resubmitted.brief.milestones[2].deliveryUrl], ['SUBMITTED', 'https://demo.example.vn/v2']);
  await svc.reviewMilestone(customer, o.id, 'M3', true, null);
  assert.equal(await balanceOf(db, escrowOf(o.id)), 870_000, 'still held through the revision round');
  await svc.transition(coder, o.id, 'DELIVERED');
  const done = await svc.transition(customer, o.id, 'ACCEPTED');
  assert.equal(done.money.heldVnd, 0);
  assert.equal(await balanceOf(db, coderOf(coder.id)), o.payoutVnd, 'the last share is paid once, not twice');
});

test('B4: a dispute after delivery still has the last milestone share to split', async () => {
  const ctx = await setup();
  const { svc, adminSvc, customer, coder } = ctx;
  const o = await inProgress(ctx);
  await approveAll(ctx, o.id);
  await svc.transition(coder, o.id, 'DELIVERED');
  const disputed = await svc.transition(customer, o.id, 'DISPUTED', 'Bàn giao thiếu trang quản trị');
  assert.equal(disputed.money.heldVnd, 870_000);
  await rejects(adminSvc.resolveDispute(o.id, { refundVnd: 870_001 }), BadRequestException);
  const resolved = await adminSvc.resolveDispute(o.id, { refundVnd: 500_000 });
  assert.deepEqual([resolved.status, resolved.escrowVnd], ['RESOLVED', 0]);
});

test('P0-7: a new order starts at the menu "giá từ", unquoted: no QR, a transfer does not fund it until the admin quotes', async () => {
  const ctx = await setup();
  const { db, svc, adminSvc, payments, admin, customer } = ctx;
  const landing = MENU.find((m) => m.code === 'DEMO_LANDING')!;
  const input = OrderCreateSchema.parse({
    prompt: 'Landing page bán khoá học',
    menuItem: 'DEMO_LANDING',
    brief: { ...brief(), milestones: brief().milestones },
    acceptTerms: true,
    phone: '0912345678',
  });
  const o = await svc.create(customer, input);
  assert.deepEqual([o.menuItem, o.priceVnd, o.priceQuotedAt, o.etaHours], ['DEMO_LANDING', landing.fromPriceVnd, null, landing.days[1] * 24]);
  const pay = await payments.instructions(customer, o.id);
  assert.deepEqual([pay.priceQuoted, pay.bank], [false, null]);
  // No QR yet, so there is no transfer to report (P0-4 needs the quote first).
  await rejects(payments.reportTransfer(customer, o.id), ConflictException);

  // The customer transferred anyway: booked on escrow, order stays DRAFT.
  await adminSvc.confirmPayment(admin, o.id, { amountVnd: 2_500_000, reference: 'FT100' });
  assert.equal((await svc.get(customer, o.id)).status, 'DRAFT');

  await rejects(adminSvc.quote(o.id, { priceVnd: 2_000_000, etaDays: 3 }), BadRequestException);
  // HON-60 cap: the admin cannot quote above MAX_ORDER_VND (service guard; the HTTP pipe rejects it earlier via OrderQuoteSchema).
  await rejects(adminSvc.quote(o.id, { priceVnd: 3_000_000, etaDays: 3 }), BadRequestException);
  const quoted = await adminSvc.quote(o.id, { priceVnd: MAX_ORDER_VND, etaDays: 3 });
  assert.deepEqual([quoted.status, quoted.priceVnd, quoted.payoutVnd, quoted.etaHours], ['DRAFT', MAX_ORDER_VND, payoutOf(MAX_ORDER_VND), 72]);
  assert.ok(quoted.priceQuotedAt);
  assert.equal((await payments.instructions(customer, o.id)).priceQuoted, true);
  assert.equal((await payments.instructions(customer, o.id)).dueVnd, MAX_ORDER_VND - 2_500_000);

  // Re-quote down to what was paid: funded right away.
  const funded = await adminSvc.quote(o.id, { priceVnd: 2_500_000, etaDays: 3 });
  assert.equal(funded.status, 'FUNDED');
  await rejects(adminSvc.quote(o.id, { priceVnd: 2_500_000, etaDays: 3 }), ConflictException);
  const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(row.payoutVnd, payoutOf(2_500_000));
});

test('HON-60: OrderQuoteSchema refuses a price above the cap with a clear message', () => {
  assert.equal(OrderQuoteSchema.safeParse({ priceVnd: MAX_ORDER_VND, etaDays: 3 }).success, true);
  const over = OrderQuoteSchema.safeParse({ priceVnd: 3_000_000, etaDays: 3 });
  assert.equal(over.success, false);
  assert.match(over.error!.issues[0].message, /tối đa 2\.990\.000/);
});

test('HON-60: every menu item is a demo under the cap', () => {
  assert.equal(MENU.length, 8);
  for (const m of MENU) assert.ok(m.fromPriceVnd <= MAX_ORDER_VND && m.fromPriceVnd % 1000 === 0, m.code);
});

test('P0-4: a payout request emits payout.requested for the admin notifier', async () => {
  const ctx = await setup();
  const { db, adminSvc, coder } = ctx;
  await db.transaction((tx) => postTx(tx, 'seed-wallet', 'DEPOSIT', null, [{ account: 'bank:sepay', amountVnd: -500_000 }, { account: coderOf(coder.id), amountVnd: 500_000 }]).then(() => undefined));
  const p = await adminSvc.requestPayout(coder, { amountVnd: 300_000, bankAccount: 'MB 0123456789 NGUYEN VAN B' });
  const [e] = await db.select().from(outbox).where(eq(outbox.subject, SUBJECTS.PAYOUT_REQUESTED));
  assert.deepEqual((e.payload as { data: unknown }).data, { payoutId: p.id, coderUserId: coder.id, amountVnd: 300_000 });
});
