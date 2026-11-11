import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { OFFER_SECONDS, PRESENCE_TTL_SECONDS, SUBJECTS, WAVE_SIZE, type DispatchOffer, type Presence } from '@grabcode/contracts/schemas';
import { DB, type Db } from '../db/client';
import { dispatchOffers, orders, users } from '../db/schema';
import { emit, OrdersService } from '../orders/orders.service';
import { dispatchEvent } from './events';

type UserRow = typeof users.$inferSelect;

const SWEEP_MS = 2000;
const pending = (orderId: unknown) =>
  sql`exists(select 1 from ${dispatchOffers} d where d.order_id = ${orderId} and d.status = 'PENDING')`;

/**
 * Matching + wave dispatch. A sweep expires stale offers, then sends the next wave for every funded,
 * unassigned order with no open offer. Safe with several core-api instances (order rows locked SKIP LOCKED).
 * shortcut: runs in-process in core-api (TS) instead of the Go `api/matching` service; split it out when
 * offer latency or coder count needs Redis geo/score indexes.
 */
@Injectable()
export class DispatchService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep().catch((e) => console.error('dispatch sweep failed', e)), SWEEP_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      await this.expire();
      const waiting = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(inArray(orders.status, ['FUNDED', 'DISPATCHED']), isNull(orders.coderUserId), sql`not ${pending(orders.id)}`))
        .orderBy(asc(orders.updatedAt))
        .limit(20);
      for (const { id } of waiting) await this.sendWave(id);
    } finally {
      this.sweeping = false;
    }
  }

  private expire() {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(dispatchOffers)
        .set({ status: 'EXPIRED' })
        .where(and(eq(dispatchOffers.status, 'PENDING'), lt(dispatchOffers.expiresAt, sql`now()`)))
        .returning();
      const byOrder = new Map<string, typeof rows>();
      for (const r of rows) byOrder.set(r.orderId, [...(byOrder.get(r.orderId) ?? []), r]);
      for (const [orderId, rs] of byOrder) {
        await dispatchEvent(tx, SUBJECTS.DISPATCH_EXPIRED, { orderId, wave: rs[0].wave, coderUserIds: rs.map((r) => r.coderUserId) });
      }
    });
  }

  /** Offers the order to the best WAVE_SIZE online coders. No candidate -> retried next sweep. */
  sendWave(orderId: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update', { skipLocked: true });
      if (!row || !['FUNDED', 'DISPATCHED'].includes(row.status) || row.coderUserId) return;
      const [open] = await tx.select({ id: dispatchOffers.id }).from(dispatchOffers).where(and(eq(dispatchOffers.orderId, orderId), eq(dispatchOffers.status, 'PENDING')));
      if (open) return;
      // Score: coders never asked about this order first, then most accepted orders, then most recently active.
      const askedBefore = sql<boolean>`exists(select 1 from ${dispatchOffers} d where d.order_id = ${orderId} and d.coder_user_id = ${users.id})`;
      const accepted = sql<number>`(select count(*)::int from ${orders} x where x.coder_user_id = ${users.id} and x.status = 'ACCEPTED')`;
      const picked = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            sql`'CODER' = any(${users.roles})`,
            eq(users.online, true),
            gt(users.lastSeenAt, sql`now() - make_interval(secs => ${PRESENCE_TTL_SECONDS})`),
            ne(users.id, row.customerUserId),
            // one open offer per coder; never re-ask a coder who declined this order; busy coders are skipped.
            sql`not exists(select 1 from ${dispatchOffers} d where d.coder_user_id = ${users.id} and (d.status = 'PENDING' or (d.order_id = ${orderId} and d.status = 'DECLINED')))`,
            sql`not exists(select 1 from ${orders} x where x.coder_user_id = ${users.id} and x.status = 'IN_PROGRESS')`,
          ),
        )
        .orderBy(asc(askedBefore), desc(accepted), desc(users.lastSeenAt))
        .limit(WAVE_SIZE);
      if (!picked.length) return;
      const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(${dispatchOffers.wave}), 0)::int` }).from(dispatchOffers).where(eq(dispatchOffers.orderId, orderId));
      const wave = last + 1;
      const expiresAt = sql`now() + make_interval(secs => ${OFFER_SECONDS})`;
      await tx.insert(dispatchOffers).values(picked.map((p) => ({ orderId, coderUserId: p.id, wave, expiresAt })));
      if (row.status === 'FUNDED') {
        const [next] = await tx.update(orders).set({ status: 'DISPATCHED', updatedAt: sql`now()` }).where(eq(orders.id, orderId)).returning();
        await emit(tx, next, 'FUNDED');
      }
      await dispatchEvent(tx, SUBJECTS.DISPATCH_OFFERED, { orderId, wave, coderUserIds: picked.map((p) => p.id) });
    });
  }

  private requireCoder(user: UserRow) {
    if (!user.roles.includes('CODER')) throw new ForbiddenException({ message: 'Missing CODER role' });
  }

  /** Open offers for the caller; polling this is the presence heartbeat. */
  async offers(user: UserRow): Promise<DispatchOffer[]> {
    this.requireCoder(user);
    await this.db.update(users).set({ lastSeenAt: sql`now()` }).where(eq(users.id, user.id));
    const rows = await this.db
      .select()
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.coderUserId, user.id), eq(dispatchOffers.status, 'PENDING'), gt(dispatchOffers.expiresAt, sql`now()`)));
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        orderId: r.orderId,
        wave: r.wave,
        status: r.status,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        order: (await this.orders.load(eq(orders.id, r.orderId)))[0],
      })),
    );
  }

  /** First accept wins: the order row lock serializes concurrent accepts; losers get 409. */
  async accept(user: UserRow, offerId: string) {
    const orderId = await this.db.transaction(async (tx) => {
      const [mine] = await tx.select().from(dispatchOffers).where(and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.coderUserId, user.id)));
      if (!mine) throw new NotFoundException({ message: 'Offer not found' });
      const [row] = await tx.select().from(orders).where(eq(orders.id, mine.orderId)).for('update');
      const [offer] = await tx
        .select({ status: dispatchOffers.status, wave: dispatchOffers.wave, live: sql<boolean>`${dispatchOffers.expiresAt} > now()` })
        .from(dispatchOffers)
        .where(eq(dispatchOffers.id, offerId));
      if (row.status !== 'DISPATCHED' || row.coderUserId || offer.status === 'LOST') throw new ConflictException({ message: 'Order already taken by another coder' });
      if (offer.status !== 'PENDING' || !offer.live) throw new ConflictException({ message: 'Offer is no longer open' });
      const [next] = await tx.update(orders).set({ status: 'IN_PROGRESS', coderUserId: user.id, updatedAt: sql`now()` }).where(eq(orders.id, row.id)).returning();
      await emit(tx, next, 'DISPATCHED');
      await tx.update(dispatchOffers).set({ status: 'ACCEPTED' }).where(eq(dispatchOffers.id, offerId));
      await tx.update(dispatchOffers).set({ status: 'LOST' }).where(and(eq(dispatchOffers.orderId, row.id), eq(dispatchOffers.status, 'PENDING')));
      await dispatchEvent(tx, SUBJECTS.DISPATCH_ACCEPTED, { orderId: row.id, wave: offer.wave, coderUserIds: [user.id] });
      return row.id;
    });
    return (await this.orders.load(eq(orders.id, orderId)))[0];
  }

  /** The next sweep sends a new wave once no offer for the order is pending. */
  async decline(user: UserRow, offerId: string) {
    const [mine] = await this.db.select({ id: dispatchOffers.id }).from(dispatchOffers).where(and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.coderUserId, user.id)));
    if (!mine) throw new NotFoundException({ message: 'Offer not found' });
    await this.db.update(dispatchOffers).set({ status: 'DECLINED' }).where(and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.status, 'PENDING')));
  }

  presence(user: UserRow): Presence {
    return { online: user.online };
  }

  async setPresence(user: UserRow, online: boolean): Promise<Presence> {
    this.requireCoder(user);
    await this.db.update(users).set({ online, lastSeenAt: sql`now()` }).where(eq(users.id, user.id));
    return { online };
  }
}
