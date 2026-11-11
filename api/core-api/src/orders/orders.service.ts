import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import {
  ORDER_SUBJECTS,
  coderTierFor,
  estimateOrder,
  payoutOf,
  type OrderCreateSchema,
  type OrderDto,
  type OrderEvent,
  type OrderStatus,
} from '@grabcode/contracts/schemas';
import type { z } from 'zod';
import { DB, type Db } from '../db/client';
import { orders, outbox, users } from '../db/schema';
import { balanceOf, postTx } from '../payments/ledger.db';
import { escrowOf, releaseEntries } from '../payments/ledger';
import { completeMilestone, isDenied, planTransition, type Denied } from './transition';

type UserRow = typeof users.$inferSelect;
type Row = typeof orders.$inferSelect;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const customer = alias(users, 'customer');
const coder = alias(users, 'coder');
const party = (u: { id: string; name: string; avatarUrl: string | null }) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl });

const fail = (d: Denied): never => {
  throw d.denied === 403 ? new ForbiddenException({ message: d.message }) : new ConflictException({ message: d.message });
};

/** customer / assigned coder, or any coder while the order is open (DISPATCHED, unassigned). */
const canRead = (r: Row, u: UserRow) =>
  r.customerUserId === u.id || r.coderUserId === u.id || (r.status === 'DISPATCHED' && !r.coderUserId && u.roles.includes('CODER'));

async function emit(tx: Tx, r: Row, from: OrderStatus | null) {
  const event: OrderEvent = {
    event_id: randomUUID(),
    type: ORDER_SUBJECTS[r.status],
    occurred_at: new Date().toISOString(),
    data: { orderId: r.id, status: r.status, from, customerUserId: r.customerUserId, coderUserId: r.coderUserId },
  };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}

/**
 * SYSTEM edge DRAFT -> FUNDED -> DISPATCHED once the escrow holds the full price.
 * `row` must be locked FOR UPDATE by the caller (same tx as the deposit).
 */
export async function fundIfCovered(tx: Tx, row: Row) {
  if (row.status !== 'DRAFT' || (await balanceOf(tx, escrowOf(row.id))) < row.priceVnd) return;
  let [next] = await tx.update(orders).set({ status: 'FUNDED', updatedAt: sql`now()` }).where(eq(orders.id, row.id)).returning();
  await emit(tx, next, 'DRAFT');
  // shortcut: dispatch right after funding (open pool) until S3 matching sends wave offers.
  [next] = await tx.update(orders).set({ status: 'DISPATCHED', updatedAt: sql`now()` }).where(eq(orders.id, row.id)).returning();
  await emit(tx, next, 'FUNDED');
}

@Injectable()
export class OrdersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(user: UserRow, input: z.output<typeof OrderCreateSchema>): Promise<OrderDto> {
    if (!user.roles.includes('CUSTOMER')) throw new ForbiddenException({ message: 'Missing CUSTOMER role' });
    const est = estimateOrder(input.tier, input.prompt, input.templateId);
    // The customer only reviewed the plan: progress always starts from scratch.
    const brief = { ...input.brief, milestones: input.brief.milestones.map(({ completedAt, commitHash, ...m }) => ({ ...m, status: 'PENDING' as const })) };
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(orders)
        .values({
          customerUserId: user.id,
          tier: input.tier,
          title: input.brief.title.replace(/^Đặc tả kỹ thuật:\s*/, ''),
          prompt: input.prompt,
          templateId: input.templateId ?? null,
          framework: input.framework,
          brief,
          priceVnd: est.priceVnd,
          etaHours: est.etaHours,
        })
        .returning();
      await emit(tx, row, null);
      return row.id;
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  /** 404 (not 403) for orders the user may not see, so ids cannot be probed. */
  async get(user: UserRow, id: string): Promise<OrderDto> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id));
    if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
    return (await this.load(eq(orders.id, id)))[0];
  }

  /** True when the user is the customer or the assigned coder (used to scope repo access). */
  async isParty(userId: string, orderId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, orderId), or(eq(orders.customerUserId, userId), eq(orders.coderUserId, userId))));
    return !!row;
  }

  async list(user: UserRow, scope: 'mine' | 'open'): Promise<OrderDto[]> {
    if (scope === 'open') {
      if (!user.roles.includes('CODER')) throw new ForbiddenException({ message: 'Missing CODER role' });
      // shortcut: open pool polled by coders until S3 matching pushes wave offers.
      return this.load(and(eq(orders.status, 'DISPATCHED'), isNull(orders.coderUserId)), 20);
    }
    return this.load(or(eq(orders.customerUserId, user.id), eq(orders.coderUserId, user.id)), 50);
  }

  async transition(user: UserRow, id: string, to: OrderStatus): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      // Row lock: two coders claiming at once serialize here; the loser sees IN_PROGRESS and gets 409.
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
      const plan = planTransition(row, user, to);
      if (isDenied(plan)) fail(plan);
      const { coderUserId } = plan as { coderUserId: string | null };
      if (to === 'ACCEPTED') {
        // FUNDED required escrow >= price, so this only trips on a corrupted ledger.
        if ((await balanceOf(tx, escrowOf(id))) < row.priceVnd) throw new ConflictException({ message: 'Escrow does not hold the order price' });
        await postTx(tx, `release:${id}`, 'RELEASE', id, releaseEntries(id, row.priceVnd, row.coderUserId!));
      }
      const [next] = await tx.update(orders).set({ status: to, coderUserId, updatedAt: sql`now()` }).where(eq(orders.id, id)).returning();
      await emit(tx, next, row.status);
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  async completeMilestone(user: UserRow, id: string, milestoneId: string, commitHash: string | null): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
      const brief = completeMilestone(row, user, milestoneId, commitHash, new Date().toISOString());
      if (isDenied(brief)) fail(brief);
      await tx.update(orders).set({ brief: brief as Row['brief'], updatedAt: sql`now()` }).where(eq(orders.id, id));
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  private async load(where: SQL | undefined, limit = 1): Promise<OrderDto[]> {
    const rows = await this.db
      .select({
        o: orders,
        customer,
        coder,
        coderAccepted: sql<number>`(select count(*)::int from ${orders} x where x.coder_user_id = ${orders.coderUserId} and x.status = 'ACCEPTED')`,
      })
      .from(orders)
      .innerJoin(customer, eq(customer.id, orders.customerUserId))
      .leftJoin(coder, eq(coder.id, orders.coderUserId))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    return rows.map(({ o, customer: c, coder: k, coderAccepted }) => ({
      id: o.id,
      status: o.status,
      tier: o.tier,
      title: o.title,
      prompt: o.prompt,
      templateId: o.templateId,
      framework: o.framework,
      brief: o.brief,
      priceVnd: o.priceVnd,
      payoutVnd: payoutOf(o.priceVnd),
      etaHours: o.etaHours,
      customer: party(c),
      // rating stays null until customer reviews exist (S4), same as /v1/me.
      coder: k && { ...party(k), stats: { tier: coderTierFor(coderAccepted), completedOrders: coderAccepted, rating: null } },
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));
  }
}
