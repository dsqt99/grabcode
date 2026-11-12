import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { connect } from 'nats';
import {
  STREAM_NAME,
  coderTierFor,
  type AdminCoder,
  type AdminCoderPatch,
  type AdminOrder,
  type DisputeResolve,
  type Monitor,
  type Payout,
  type PayoutCreate,
  type PayoutDecision,
  type SuspenseItem,
} from '@grabcode/contracts/schemas';
import { DB, type Db } from '../db/client';
import { briefJobs, ledgerEntries, ledgerTxs, orderRepos, orders, outbox, payoutRequests, users } from '../db/schema';
import { emit, fundIfCovered, type Tx } from '../orders/orders.service';
import { balanceOf, postTx } from '../payments/ledger.db';
import { SUSPENSE, coderOf, escrowOf, moveEntries, payoutEntries, resolveEntries } from '../payments/ledger';
import { ReposService } from '../repos/repos.service';

type UserRow = typeof users.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

const customer = alias(users, 'customer');
const coder = alias(users, 'coder');
const iso = (d: Date | string) => new Date(d).toISOString();

// Raw "users"."id": drizzle renders ${users.id} unqualified on single-table selects, which the subquery would rebind.
const acceptedCount = sql<number>`(select count(*)::int from core.orders o where o.coder_user_id = "users"."id" and o.status = 'ACCEPTED')`;
const walletOf = sql<string>`(select coalesce(sum(e.amount_vnd), 0) from core.ledger_entries e where e.account = 'coder:' || "users"."id")`;
const escrowSql = sql<string>`(select coalesce(sum(e.amount_vnd), 0) from core.ledger_entries e where e.account = 'escrow:' || "orders"."id")`;
const paidSql = sql<string>`(select coalesce(sum(e.amount_vnd), 0) from core.ledger_entries e where e.account = 'escrow:' || "orders"."id" and e.amount_vnd > 0)`;
/** Statuses where money left in escrow is not owed to anyone in progress: refundable by an admin. */
const REFUNDABLE = ['DRAFT', 'ACCEPTED', 'RESOLVED', 'CANCELLED'] as const;

/** Wallet minus PENDING payout requests: what a coder may still request / an admin may still pay. */
async function freeWallet(tx: Tx, userId: string, exceptId?: string) {
  const [p] = await tx
    .select({ v: sql<string>`coalesce(sum(${payoutRequests.amountVnd}), 0)` })
    .from(payoutRequests)
    .where(
      and(
        eq(payoutRequests.coderUserId, userId),
        eq(payoutRequests.status, 'PENDING'),
        exceptId ? sql`${payoutRequests.id} <> ${exceptId}` : undefined,
      ),
    );
  return (await balanceOf(tx, coderOf(userId))) - Number(p.v);
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ReposService) private readonly repos: ReposService,
  ) {}

  // ---- Coders ----

  async coders(id?: string): Promise<AdminCoder[]> {
    const rows = await this.db
      .select({ u: users, accepted: acceptedCount, balance: walletOf })
      .from(users)
      .where(and(sql`'CODER' = any(${users.roles})`, id ? eq(users.id, id) : undefined))
      .orderBy(asc(users.createdAt));
    return rows.map(({ u, accepted, balance }) => ({
      id: u.id,
      name: u.name,
      githubLogin: u.githubLogin,
      email: u.email,
      tier: u.tierOverride ?? coderTierFor(accepted),
      tierOverride: u.tierOverride,
      suspended: u.suspended,
      online: u.online,
      completedOrders: accepted,
      balanceVnd: Number(balance),
      createdAt: iso(u.createdAt),
    }));
  }

  async patchCoder(id: string, patch: AdminCoderPatch): Promise<AdminCoder> {
    const set: Partial<typeof users.$inferInsert> = {};
    if (patch.tierOverride !== undefined) set.tierOverride = patch.tierOverride;
    if (patch.suspended !== undefined) set.suspended = patch.suspended;
    // A suspended coder also drops off the online pool right away.
    if (patch.suspended) set.online = false;
    const [row] = await this.db
      .update(users)
      .set(set)
      .where(and(eq(users.id, id), sql`'CODER' = any(${users.roles})`))
      .returning({ id: users.id });
    if (!row) throw new NotFoundException({ message: 'Coder not found' });
    return (await this.coders(id))[0];
  }

  // ---- Orders: disputes, refunds ----

  async orders(id?: string): Promise<AdminOrder[]> {
    const rows = await this.db
      .select({ o: orders, customerName: customer.name, coderName: coder.name, escrow: escrowSql, paid: paidSql })
      .from(orders)
      .innerJoin(customer, eq(customer.id, orders.customerUserId))
      .leftJoin(coder, eq(coder.id, orders.coderUserId))
      .where(
        id
          ? eq(orders.id, id)
          : or(eq(orders.status, 'DISPUTED'), and(inArray(orders.status, [...REFUNDABLE]), sql`${escrowSql} > 0`)),
      )
      .orderBy(desc(orders.updatedAt))
      .limit(200);
    return rows.map(({ o, customerName, coderName, escrow, paid }) => ({
      id: o.id,
      status: o.status,
      title: o.title,
      priceVnd: o.priceVnd,
      paidVnd: Number(paid),
      escrowVnd: Number(escrow),
      disputeReason: o.disputeReason,
      customerName,
      coderName,
      updatedAt: iso(o.updatedAt),
    }));
  }

  private async lockOrder(tx: Tx, id: string): Promise<OrderRow> {
    const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!row) throw new NotFoundException({ message: 'Order not found' });
    return row;
  }

  async resolveDispute(id: string, body: DisputeResolve): Promise<AdminOrder> {
    await this.db.transaction(async (tx) => {
      const row = await this.lockOrder(tx, id);
      if (row.status !== 'DISPUTED') throw new ConflictException({ message: 'Order is not DISPUTED' });
      const escrow = await balanceOf(tx, escrowOf(id));
      if (body.refundVnd > escrow) throw new BadRequestException({ message: `Refund above escrow (${escrow} VND)` });
      if (escrow > 0) {
        // A dispute always has an assigned coder (only DELIVERED orders can be disputed).
        await postTx(tx, `resolve:${id}`, 'RELEASE', id, resolveEntries(id, escrow, body.refundVnd, row.coderUserId!), {
          refundVnd: body.refundVnd,
          note: body.note ?? null,
        });
      }
      const [next] = await tx.update(orders).set({ status: 'RESOLVED', updatedAt: sql`now()` }).where(eq(orders.id, id)).returning();
      await emit(tx, next, 'DISPUTED');
    });
    return (await this.orders(id))[0];
  }

  /** Refunds what escrow holds. DRAFT -> CANCELLED (even with nothing paid); closed orders: overpayment only. */
  async refund(id: string): Promise<AdminOrder> {
    await this.db.transaction(async (tx) => {
      const row = await this.lockOrder(tx, id);
      if (!(REFUNDABLE as readonly string[]).includes(row.status)) throw new ConflictException({ message: `Order ${row.status} is in progress` });
      const escrow = await balanceOf(tx, escrowOf(id));
      if (escrow <= 0 && row.status !== 'DRAFT') throw new ConflictException({ message: 'Escrow is empty' });
      if (escrow > 0) await postTx(tx, `refund:${id}:${randomUUID()}`, 'REFUND', id, payoutEntries(escrowOf(id), escrow));
      if (row.status === 'DRAFT') {
        const [next] = await tx.update(orders).set({ status: 'CANCELLED', updatedAt: sql`now()` }).where(eq(orders.id, id)).returning();
        await emit(tx, next, 'DRAFT');
      }
    });
    return (await this.orders(id))[0];
  }

  // ---- Suspense ----

  async suspense(): Promise<SuspenseItem[]> {
    const rows = await this.db
      .select({ txId: ledgerTxs.id, amount: ledgerEntries.amountVnd, meta: ledgerTxs.meta, createdAt: ledgerTxs.createdAt })
      .from(ledgerTxs)
      .innerJoin(ledgerEntries, and(eq(ledgerEntries.txId, ledgerTxs.id), eq(ledgerEntries.account, SUSPENSE), gt(ledgerEntries.amountVnd, 0)))
      .where(sql`not exists (select 1 from core.ledger_txs r where r.id = 'suspense:' || ${ledgerTxs.id})`)
      .orderBy(asc(ledgerTxs.createdAt));
    return rows.map((r) => ({
      txId: r.txId,
      amountVnd: r.amount,
      content: String((r.meta as { content?: unknown } | null)?.content ?? ''),
      createdAt: iso(r.createdAt),
    }));
  }

  async resolveSuspense(txId: string, orderId: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [e] = await tx
        .select({ amount: ledgerEntries.amountVnd })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.txId, txId), eq(ledgerEntries.account, SUSPENSE), gt(ledgerEntries.amountVnd, 0)));
      if (!e) throw new NotFoundException({ message: 'Suspense deposit not found' });
      const id = `suspense:${txId}`;
      if (orderId === null) {
        if (!(await postTx(tx, id, 'REFUND', null, payoutEntries(SUSPENSE, e.amount), { from: txId }))) throw new ConflictException({ message: 'Already reconciled' });
        return;
      }
      const row = await this.lockOrder(tx, orderId);
      if (!(await postTx(tx, id, 'ADJUST', row.id, moveEntries(SUSPENSE, escrowOf(row.id), e.amount), { from: txId })))
        throw new ConflictException({ message: 'Already reconciled' });
      await fundIfCovered(tx, row);
    });
  }

  // ---- Payouts ----

  private async payouts(where?: ReturnType<typeof eq>): Promise<Payout[]> {
    const rows = await this.db
      .select({ p: payoutRequests, coderName: users.name })
      .from(payoutRequests)
      .innerJoin(users, eq(users.id, payoutRequests.coderUserId))
      .where(where)
      .orderBy(sql`${payoutRequests.status} = 'PENDING' desc`, desc(payoutRequests.createdAt))
      .limit(200);
    return rows.map(({ p, coderName }) => ({
      id: p.id,
      coderUserId: p.coderUserId,
      coderName,
      amountVnd: p.amountVnd,
      bankAccount: p.bankAccount,
      status: p.status,
      note: p.note,
      createdAt: iso(p.createdAt),
      decidedAt: p.decidedAt ? iso(p.decidedAt) : null,
    }));
  }

  allPayouts = () => this.payouts();
  myPayouts = (user: UserRow) => this.payouts(eq(payoutRequests.coderUserId, user.id));

  async requestPayout(user: UserRow, body: PayoutCreate): Promise<Payout> {
    if (!user.roles.includes('CODER')) throw new ForbiddenException({ message: 'Missing CODER role' });
    const id = await this.db.transaction(async (tx) => {
      // Lock the coder row so two concurrent requests cannot both pass the balance check.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
      const free = await freeWallet(tx, user.id);
      if (body.amountVnd > free) throw new ConflictException({ message: `Amount above available balance (${free} VND)` });
      const [r] = await tx.insert(payoutRequests).values({ coderUserId: user.id, amountVnd: body.amountVnd, bankAccount: body.bankAccount }).returning();
      return r.id;
    });
    return (await this.payouts(eq(payoutRequests.id, id)))[0];
  }

  async decidePayout(admin: UserRow, id: string, body: PayoutDecision): Promise<Payout> {
    await this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payoutRequests).where(eq(payoutRequests.id, id)).for('update');
      if (!p) throw new NotFoundException({ message: 'Payout not found' });
      if (p.status !== 'PENDING') throw new ConflictException({ message: `Payout already ${p.status}` });
      if (body.approve) {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, p.coderUserId)).for('update');
        if (p.amountVnd > (await freeWallet(tx, p.coderUserId, p.id))) throw new ConflictException({ message: 'Wallet too low' });
        await postTx(tx, `payout:${p.id}`, 'PAYOUT', null, payoutEntries(coderOf(p.coderUserId), p.amountVnd), { bankAccount: p.bankAccount });
      }
      await tx
        .update(payoutRequests)
        .set({ status: body.approve ? 'PAID' : 'REJECTED', note: body.note ?? null, decidedBy: admin.id, decidedAt: sql`now()` })
        .where(eq(payoutRequests.id, id));
    });
    return (await this.payouts(eq(payoutRequests.id, id)))[0];
  }

  // ---- Worker / queue monitor ----

  async monitor(): Promise<Monitor> {
    const [[ob], rt, briefs, repos, consumers] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(*)::int`, oldest: sql<number | null>`extract(epoch from now() - min(${outbox.createdAt}))::int` })
        .from(outbox)
        .where(isNull(outbox.publishedAt)),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from public.centrifugo_outbox`),
      this.db.select().from(briefJobs).where(eq(briefJobs.status, 'FAILED')).orderBy(desc(briefJobs.updatedAt)).limit(20),
      this.db.select().from(orderRepos).where(eq(orderRepos.status, 'FAILED')).orderBy(desc(orderRepos.updatedAt)).limit(20),
      natsConsumers(),
    ]);
    const rtRows = (Array.isArray(rt) ? rt : (rt as { rows: { n: number }[] }).rows) as { n: number }[];
    return {
      outboxPending: ob.n,
      outboxOldestSeconds: ob.oldest,
      realtimePending: Number(rtRows[0]?.n ?? 0),
      failedJobs: [
        ...briefs.map((b) => ({ kind: 'brief' as const, id: b.id, orderId: null, error: b.error, updatedAt: iso(b.updatedAt), retryable: false })),
        ...repos.map((r) => ({ kind: 'repo' as const, id: r.orderId, orderId: r.orderId, error: r.error, updatedAt: iso(r.updatedAt), retryable: true })),
      ],
      consumers,
    };
  }

  async retryRepo(orderId: string): Promise<void> {
    const [r] = await this.db
      .select({ status: orderRepos.status, order: orders, coder: users })
      .from(orderRepos)
      .innerJoin(orders, eq(orders.id, orderRepos.orderId))
      .innerJoin(users, eq(users.id, orderRepos.coderUserId))
      .where(eq(orderRepos.orderId, orderId));
    if (!r) throw new NotFoundException({ message: 'Repo job not found' });
    if (r.status !== 'FAILED') throw new ConflictException({ message: `Repo job is ${r.status}` });
    await this.repos.request(r.coder, { orderId, title: r.order.title, claudeMd: r.order.brief.claudeMdContent });
  }
}

/** JetStream consumer lag; null when NATS is down (short-lived connection, 2s timeout). */
async function natsConsumers(): Promise<Monitor['consumers']> {
  try {
    const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223', timeout: 2000 });
    try {
      const jsm = await nc.jetstreamManager({ timeout: 2000 });
      const out: NonNullable<Monitor['consumers']> = [];
      for await (const c of jsm.consumers.list(STREAM_NAME)) {
        out.push({ name: c.name, pending: c.num_pending, ackPending: c.num_ack_pending, redelivered: c.num_redelivered });
      }
      return out;
    } finally {
      await nc.close();
    }
  } catch {
    return null;
  }
}
