import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AIBrief } from '@grabcode/contracts';
import {
  SUBJECTS,
  type BriefJob,
  type BriefJobCreateSchema,
  type BriefRequestedEvent,
} from '@grabcode/contracts/schemas';
import type { z } from 'zod';
import { DB, type Db } from '../db/client';
import { briefJobs, outbox } from '../db/schema';

type Row = typeof briefJobs.$inferSelect;

const toDto = (r: Row): BriefJob => ({
  id: r.id,
  status: r.status,
  prompt: r.prompt,
  tier: r.tier,
  templateId: r.templateId,
  framework: r.framework,
  brief: r.brief ?? null,
  error: r.error,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

@Injectable()
export class BriefsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Insert job + outbox event atomically. The LLM call happens in brief-worker, never here. */
  async create(input: z.output<typeof BriefJobCreateSchema>): Promise<BriefJob> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(briefJobs)
        .values({
          prompt: input.prompt,
          tier: input.tier,
          templateId: input.templateId ?? null,
          framework: input.framework,
        })
        .returning();
      const event: BriefRequestedEvent = {
        event_id: randomUUID(),
        type: SUBJECTS.BRIEF_REQUESTED,
        occurred_at: new Date().toISOString(),
        data: {
          jobId: row.id,
          prompt: row.prompt,
          tier: row.tier,
          templateId: row.templateId,
          framework: row.framework,
        },
      };
      await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
      return toDto(row);
    });
  }

  async get(id: string): Promise<BriefJob | undefined> {
    const [row] = await this.db.select().from(briefJobs).where(eq(briefJobs.id, id));
    return row && toDto(row);
  }

  // Both result handlers only touch PENDING rows, so redelivered events are no-ops (idempotent).
  async markReady(jobId: string, brief: AIBrief): Promise<void> {
    await this.db
      .update(briefJobs)
      .set({ status: 'READY', brief, updatedAt: sql`now()` }) // DB clock, same source as createdAt
      .where(and(eq(briefJobs.id, jobId), eq(briefJobs.status, 'PENDING')));
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(briefJobs)
      .set({ status: 'FAILED', error, updatedAt: sql`now()` }) // DB clock, same source as createdAt
      .where(and(eq(briefJobs.id, jobId), eq(briefJobs.status, 'PENDING')));
  }
}
