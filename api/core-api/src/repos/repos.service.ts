import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  SUBJECTS,
  type OrderRepo,
  type RepoCreateSchema,
  type RepoHandoverRequestedEvent,
  type RepoProvisionedEvent,
  type RepoRequestedEvent,
} from '@grabcode/contracts/schemas';
import type { z } from 'zod';
import { DB, type Db } from '../db/client';
import { coderProfiles, orderRepos, orders, outbox, repoCommits, type users } from '../db/schema';

type UserRow = typeof users.$inferSelect;
type Row = typeof orderRepos.$inferSelect;

export const repoNameFor = (orderId: string) => `gc-${orderId.toLowerCase().replace(/^gc-/, '')}`;

/** github.com/<login> from the coder profile URL; logins are alnum + single dashes, max 39. */
export const githubLoginFromUrl = (url: string | null | undefined) =>
  url?.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/?$/)?.[1] ?? null;

@Injectable()
export class ReposService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Insert repo row + outbox repo.requested atomically. GitHub is only called by repo-worker.
   * Idempotent per orderId: an existing PENDING/READY repo is returned as is, a FAILED one is re-queued.
   */
  async request(user: UserRow, input: z.output<typeof RepoCreateSchema>): Promise<OrderRepo> {
    // Only the coder the order is assigned to (status IN_PROGRESS or later) may open its repo.
    const [order] = await this.db.select({ coderUserId: orders.coderUserId }).from(orders).where(eq(orders.id, input.orderId));
    if (!order) throw new NotFoundException({ message: 'Order not found' });
    if (order.coderUserId !== user.id) throw new ForbiddenException({ message: 'Not the assigned coder of this order' });
    const [profile] = await this.db
      .select({ githubUrl: coderProfiles.githubUrl })
      .from(coderProfiles)
      .where(eq(coderProfiles.userId, user.id));
    const login = user.githubLogin ?? githubLoginFromUrl(profile?.githubUrl);

    const orderId = await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(orderRepos).where(eq(orderRepos.orderId, input.orderId)).for('update');
      if (existing && existing.coderUserId !== user.id) throw new ForbiddenException({ message: 'Order belongs to another coder' });
      if (existing && existing.status !== 'FAILED') return existing.orderId;
      await tx
        .insert(orderRepos)
        .values({ orderId: input.orderId, coderUserId: user.id })
        .onConflictDoUpdate({ target: orderRepos.orderId, set: { status: 'PENDING', error: null, updatedAt: sql`now()` } });
      const event: RepoRequestedEvent = {
        event_id: randomUUID(),
        type: SUBJECTS.REPO_REQUESTED,
        occurred_at: new Date().toISOString(),
        data: {
          orderId: input.orderId,
          title: input.title,
          repoName: repoNameFor(input.orderId),
          coderGithubLogin: login,
          claudeMd: input.claudeMd,
        },
      };
      await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
      return input.orderId;
    });
    return (await this.get(orderId))!;
  }

  /** Customer names the GitHub login for an ACCEPTED order's repo; repo-worker invites it as admin (same event as the automatic handover). */
  async handover(user: UserRow, orderId: string, githubLogin: string): Promise<OrderRepo> {
    await this.db.transaction(async (tx) => {
      const [o] = await tx.select({ status: orders.status, customerUserId: orders.customerUserId }).from(orders).where(eq(orders.id, orderId));
      if (!o || o.customerUserId !== user.id) throw new NotFoundException({ message: 'Order not found' });
      const [r] = await tx.select().from(orderRepos).where(eq(orderRepos.orderId, orderId)).for('update');
      if (o.status !== 'ACCEPTED' || r?.status !== 'READY' || !r.repoFullName || r.handedOverTo) {
        throw new ConflictException({ message: 'Repo is handed over once, after the order is ACCEPTED' });
      }
      const event: RepoHandoverRequestedEvent = {
        event_id: randomUUID(),
        type: SUBJECTS.REPO_HANDOVER_REQUESTED,
        occurred_at: new Date().toISOString(),
        data: { orderId, repoFullName: r.repoFullName, customerGithubLogin: githubLogin, coderGithubLogin: r.collaborator },
      };
      await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
    });
    return (await this.get(orderId))!;
  }

  async get(orderId: string): Promise<OrderRepo | undefined> {
    const [r] = await this.db.select().from(orderRepos).where(eq(orderRepos.orderId, orderId));
    if (!r) return undefined;
    const commits = await this.db
      .select()
      .from(repoCommits)
      .where(eq(repoCommits.orderId, orderId))
      .orderBy(desc(repoCommits.pushedAt))
      .limit(50);
    return toDto(r, commits);
  }

  // Result handlers only touch PENDING rows, so redelivered events are no-ops.
  async markReady(d: RepoProvisionedEvent['data']): Promise<void> {
    await this.db
      .update(orderRepos)
      .set({ status: 'READY', repoFullName: d.repoFullName, htmlUrl: d.htmlUrl, cloneUrl: d.cloneUrl, collaborator: d.collaborator, updatedAt: sql`now()` })
      .where(and(eq(orderRepos.orderId, d.orderId), eq(orderRepos.status, 'PENDING')));
  }

  async markFailed(orderId: string, error: string): Promise<void> {
    await this.db
      .update(orderRepos)
      .set({ status: 'FAILED', error, updatedAt: sql`now()` })
      .where(and(eq(orderRepos.orderId, orderId), eq(orderRepos.status, 'PENDING')));
  }

  /** repo-worker finished a handover; a late result without a login never clears one already given. */
  async markHandedOver(orderId: string, to: string | null): Promise<void> {
    await this.db
      .update(orderRepos)
      .set({ handedOverAt: sql`now()`, handedOverTo: sql`coalesce(${to}, ${orderRepos.handedOverTo})`, updatedAt: sql`now()` }).where(eq(orderRepos.orderId, orderId));
  }

  /** Push webhook: store commits of a known repo; unknown repos are ignored. sha PK dedupes redeliveries. */
  async recordPush(repoFullName: string, commits: { id: string; message: string; author?: { name?: string; username?: string }; url: string; timestamp: string }[]) {
    let [r] = await this.db.select({ orderId: orderRepos.orderId }).from(orderRepos).where(eq(orderRepos.repoFullName, repoFullName));
    // The CLAUDE.md commit's push can beat repo.provisioned (row still PENDING, no full name): match gc-<n> to its order instead.
    const n = /\/gc-(\d+)$/.exec(repoFullName)?.[1];
    if (!r && n) [r] = await this.db.select({ orderId: orderRepos.orderId }).from(orderRepos).where(and(eq(orderRepos.orderId, `GC-${n}`), isNull(orderRepos.repoFullName)));
    if (!r || commits.length === 0) return;
    await this.db
      .insert(repoCommits)
      .values(
        commits.map((c) => ({
          sha: c.id,
          orderId: r.orderId,
          message: c.message.slice(0, 2000),
          author: c.author?.username ?? c.author?.name ?? 'unknown',
          url: c.url,
          pushedAt: new Date(c.timestamp),
        })),
      )
      .onConflictDoNothing();
  }
}

const toDto = (r: Row, commits: (typeof repoCommits.$inferSelect)[]): OrderRepo => ({
  orderId: r.orderId,
  status: r.status,
  repoFullName: r.repoFullName,
  htmlUrl: r.htmlUrl,
  cloneUrl: r.cloneUrl,
  collaborator: r.collaborator,
  error: r.error,
  handedOverAt: r.handedOverAt?.toISOString() ?? null,
  handedOverTo: r.handedOverTo,
  commits: commits.map((c) => ({ sha: c.sha, message: c.message, author: c.author, url: c.url, pushedAt: c.pushedAt.toISOString() })),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
