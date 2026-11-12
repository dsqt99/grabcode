import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import {
  ORDER_SUBJECTS,
  SUBJECTS,
  coderTierFor,
  estimateOrder,
  payoutOf,
  type DeployRequestedEvent,
  type MilestoneEvent,
  type QaRequestedEvent,
  type QaResultSchema,
  type Sandbox,
  type OrderCreateSchema,
  type OrderDto,
  type RepoHandoverRequestedEvent,
  type OrderEvent,
  type OrderStatus,
  type ChatMessage,
} from '@grabcode/contracts/schemas';
import type { z } from 'zod';
import { DB, type Db } from '../db/client';
import { ledgerTxs, orderMessages, orderRepos, orders, outbox, repoCommits, users } from '../db/schema';
import { balanceOf, postTx } from '../payments/ledger.db';
import { escrowOf, releaseEntries } from '../payments/ledger';
import { dispatchEvent } from '../dispatch/events';
import { isDenied, planTransition, reviewMilestone, submitMilestone, type Denied } from './transition';

type UserRow = typeof users.$inferSelect;
type Row = typeof orders.$inferSelect;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const customer = alias(users, 'customer');
const coder = alias(users, 'coder');
const party = (u: { id: string; name: string; avatarUrl: string | null }) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl });

const fail = (d: Denied): never => {
  throw d.denied === 403 ? new ForbiddenException({ message: d.message }) : new ConflictException({ message: d.message });
};

/** customer / assigned coder. Coders see unassigned orders only inside their wave offers. */
const canRead = (r: Row, u: UserRow) => r.customerUserId === u.id || r.coderUserId === u.id;

export async function emit(tx: Tx, r: Row, from: OrderStatus | null) {
  const event: OrderEvent = {
    event_id: randomUUID(),
    type: ORDER_SUBJECTS[r.status],
    occurred_at: new Date().toISOString(),
    data: { orderId: r.id, status: r.status, from, customerUserId: r.customerUserId, coderUserId: r.coderUserId },
  };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}

/**
 * SYSTEM edge DRAFT -> FUNDED once the escrow holds the full price; dispatch then sends the first wave.
 * `row` must be locked FOR UPDATE by the caller (same tx as the deposit).
 */
export async function fundIfCovered(tx: Tx, row: Row) {
  if (row.status !== 'DRAFT' || (await balanceOf(tx, escrowOf(row.id))) < row.priceVnd) return;
  const [next] = await tx.update(orders).set({ status: 'FUNDED', updatedAt: sql`now()` }).where(eq(orders.id, row.id)).returning();
  await emit(tx, next, 'DRAFT');
  await dispatchEvent(tx, SUBJECTS.DISPATCH_REQUESTED, { orderId: row.id, wave: 0, coderUserIds: [] });
}

/**
 * Pays out milestone `index`'s escrow share. Idempotent per milestone (tx id), so ACCEPTED can sweep every
 * milestone and only unpaid ones move. Returns the amount released (0 when already paid or zero-weight).
 */
async function releaseMilestone(tx: Tx, row: Row, index: number): Promise<number> {
  const ms = row.brief.milestones;
  const entries = releaseEntries(row.id, row.priceVnd, ms.map((m) => m.weightPercent), index, row.coderUserId!);
  const amount = -entries[0].amountVnd;
  const txId = `release:${row.id}:${ms[index].id}`;
  const [done] = await tx.select({ id: ledgerTxs.id }).from(ledgerTxs).where(eq(ledgerTxs.id, txId));
  if (done || amount === 0) return 0;
  // Funding required escrow >= price, so this only trips on a corrupted ledger.
  if ((await balanceOf(tx, escrowOf(row.id))) < amount) throw new ConflictException({ message: 'Escrow does not hold this milestone share' });
  await postTx(tx, txId, 'RELEASE', row.id, entries);
  return amount;
}

async function emitMilestone(tx: Tx, type: MilestoneEvent['type'], data: MilestoneEvent['data']) {
  const event: MilestoneEvent = { event_id: randomUUID(), type, occurred_at: new Date().toISOString(), data };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}

async function readyRepo(tx: Tx, orderId: string) {
  const [repo] = await tx.select().from(orderRepos).where(eq(orderRepos.orderId, orderId));
  return repo?.status === 'READY' && repo.repoFullName ? { ...repo, repoFullName: repo.repoFullName } : null;
}

async function outboxEvent(tx: Tx, event: QaRequestedEvent | DeployRequestedEvent) {
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}

/** ACCEPTED: repo-worker gives the customer admin on the order repo and drops the coder to read. */
async function requestHandover(tx: Tx, row: Row) {
  const repo = await readyRepo(tx, row.id);
  if (!repo) return;
  const [c] = await tx.select({ githubLogin: users.githubLogin }).from(users).where(eq(users.id, row.customerUserId));
  const event: RepoHandoverRequestedEvent = {
    event_id: randomUUID(),
    type: SUBJECTS.REPO_HANDOVER_REQUESTED,
    occurred_at: new Date().toISOString(),
    data: { orderId: row.id, repoFullName: repo.repoFullName, customerGithubLogin: c?.githubLogin ?? null, coderGithubLogin: repo.collaborator },
  };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}

const chatOf = (r: Row, m: typeof orderMessages.$inferSelect, senderName: string): ChatMessage => ({
  id: m.id,
  orderId: m.orderId,
  sender: m.senderUserId === r.customerUserId ? 'CUSTOMER' : 'CODER',
  senderName,
  text: m.body,
  timestamp: m.createdAt.toISOString(),
});

@Injectable()
export class OrdersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(user: UserRow, input: z.output<typeof OrderCreateSchema>): Promise<OrderDto> {
    if (!user.roles.includes('CUSTOMER')) throw new ForbiddenException({ message: 'Missing CUSTOMER role' });
    const est = estimateOrder(input.tier, input.prompt, input.templateId);
    // The customer only reviewed the plan: progress always starts from scratch.
    const brief = { ...input.brief, milestones: input.brief.milestones.map(({ completedAt, commitHash, submittedAt, note, ...m }) => ({ ...m, status: 'PENDING' as const })) };
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

  /** Order chat, oldest first. Only the customer and the assigned coder can read or write it. */
  async messages(user: UserRow, id: string): Promise<ChatMessage[]> {
    const row = await this.party(user, id);
    const rows = await this.db
      .select({ m: orderMessages, name: users.name })
      .from(orderMessages)
      .innerJoin(users, eq(users.id, orderMessages.senderUserId))
      .where(eq(orderMessages.orderId, id))
      .orderBy(desc(orderMessages.createdAt))
      .limit(200);
    return rows.reverse().map(({ m, name }) => chatOf(row, m, name));
  }

  /** The insert trigger pushes a `chat` hint to both parties. */
  async sendMessage(user: UserRow, id: string, text: string): Promise<ChatMessage> {
    const row = await this.party(user, id);
    const [m] = await this.db.insert(orderMessages).values({ orderId: id, senderUserId: user.id, body: text }).returning();
    return chatOf(row, m, user.name);
  }

  private async party(user: UserRow, id: string) {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id));
    if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
    return row;
  }

  /** True when the user is the customer or the assigned coder (used to scope repo access). */
  async isParty(userId: string, orderId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, orderId), or(eq(orders.customerUserId, userId), eq(orders.coderUserId, userId))));
    return !!row;
  }

  async list(user: UserRow): Promise<OrderDto[]> {
    return this.load(or(eq(orders.customerUserId, user.id), eq(orders.coderUserId, user.id)), 50);
  }

  async transition(user: UserRow, id: string, to: OrderStatus, reason?: string): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      // Row lock: concurrent transitions (and offer accepts) on one order serialize here.
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
      const plan = planTransition(row, user, to);
      if (isDenied(plan)) fail(plan);
      const { coderUserId } = plan as { coderUserId: string | null };
      if (to === 'ACCEPTED') {
        // Pays whatever milestone shares are still held (all of them for orders delivered before S4).
        for (let i = 0; i < row.brief.milestones.length; i++) await releaseMilestone(tx, row, i);
        await requestHandover(tx, row);
      }
      // DELIVERED: deploy-worker builds the last submitted commit (default branch when none) as a preview.
      let sandbox: Sandbox | undefined;
      const repo = to === 'DELIVERED' ? await readyRepo(tx, id) : null;
      if (repo) {
        sandbox = { status: 'PENDING', url: null, error: null, expiresAt: null };
        const commitHash = [...row.brief.milestones].reverse().find((m) => m.commitHash)?.commitHash ?? null;
        await outboxEvent(tx, {
          event_id: randomUUID(),
          type: SUBJECTS.DEPLOY_REQUESTED,
          occurred_at: new Date().toISOString(),
          data: { orderId: id, repoFullName: repo.repoFullName, commitHash },
        });
      }
      const [next] = await tx
        .update(orders)
        .set({ status: to, coderUserId, ...(to === 'DISPUTED' ? { disputeReason: reason ?? null } : {}), ...(sandbox ? { sandbox } : {}), updatedAt: sql`now()` })
        .where(eq(orders.id, id))
        .returning();
      await emit(tx, next, row.status);
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  async submitMilestone(user: UserRow, id: string, milestoneId: string, commitHash: string | null, note: string | null): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
      let sha = commitHash;
      if (commitHash) {
        // Must be a pushed commit of this order's repo (webhook timeline); a prefix resolves to the full sha.
        const [c] = await tx
          .select({ sha: repoCommits.sha })
          .from(repoCommits)
          .where(and(eq(repoCommits.orderId, id), like(repoCommits.sha, `${commitHash}%`)))
          .limit(1);
        if (!c) throw new BadRequestException({ message: 'Commit not found in the order repo' });
        sha = c.sha;
      }
      const brief = submitMilestone(row, user, milestoneId, sha, note, new Date().toISOString());
      if (isDenied(brief)) fail(brief);
      // QA Gate on every submit with a repo; the previous result is dropped so the customer never sees a stale one.
      const m = (brief as Row['brief']).milestones.find((x) => x.id === milestoneId)!;
      delete m.qa;
      const repo = await readyRepo(tx, id);
      if (repo) {
        m.qa = { status: 'RUNNING', commitHash: sha, checks: [] };
        await outboxEvent(tx, {
          event_id: randomUUID(),
          type: SUBJECTS.QA_REQUESTED,
          occurred_at: new Date().toISOString(),
          data: { orderId: id, milestoneId, repoFullName: repo.repoFullName, commitHash: sha },
        });
      }
      await tx.update(orders).set({ brief: brief as Row['brief'], updatedAt: sql`now()` }).where(eq(orders.id, id));
      await emitMilestone(tx, SUBJECTS.MILESTONE_SUBMITTED, { orderId: id, milestoneId, commitHash: sha, note, releasedVnd: 0 });
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  /** approve: COMPLETED + release that milestone's escrow share; reject: back to IN_PROGRESS with the note. */
  async reviewMilestone(user: UserRow, id: string, milestoneId: string, approve: boolean, note: string | null): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row || !canRead(row, user)) throw new NotFoundException({ message: 'Order not found' });
      const r = reviewMilestone(row, user, milestoneId, approve, note, new Date().toISOString());
      if (isDenied(r)) fail(r);
      const { brief, index } = r as { brief: Row['brief']; index: number };
      const releasedVnd = approve ? await releaseMilestone(tx, row, index) : 0;
      await tx.update(orders).set({ brief, updatedAt: sql`now()` }).where(eq(orders.id, id));
      await emitMilestone(tx, approve ? SUBJECTS.MILESTONE_APPROVED : SUBJECTS.MILESTONE_REJECTED, {
        orderId: id,
        milestoneId,
        commitHash: row.brief.milestones[index].commitHash ?? null,
        note,
        releasedVnd,
      });
    });
    return (await this.load(eq(orders.id, id)))[0];
  }

  /** qa.completed: applied only while the milestone still waits on that exact commit (a resubmit makes it stale). */
  async applyQa(orderId: string, milestoneId: string, result: z.infer<typeof QaResultSchema>) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      const m = row?.brief.milestones.find((x) => x.id === milestoneId);
      if (!m || m.qa?.status !== 'RUNNING' || m.qa.commitHash !== result.commitHash) return;
      m.qa = result;
      await tx.update(orders).set({ brief: row.brief, updatedAt: sql`now()` }).where(eq(orders.id, orderId));
    });
  }

  /** deploy.ready / failed / expired. shortcut: last result wins; a stale deploy finishing after a redeploy can overwrite, add a deploy id if that shows up. */
  async applySandbox(orderId: string, sandbox: Sandbox) {
    await this.db.update(orders).set({ sandbox, updatedAt: sql`now()` }).where(eq(orders.id, orderId));
  }

  async load(where: SQL | undefined, limit = 1): Promise<OrderDto[]> {
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
      disputeReason: o.disputeReason,
      sandbox: o.sandbox,
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
