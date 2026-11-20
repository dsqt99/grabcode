import { eq, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rateLimits } from '../db/schema';

/**
 * Attempt counter per key (email, IP), fixed window: more than `max` attempts inside `windowMs` blocks the key until the window ends.
 * Counts live in Postgres (core.rate_limits), so every core-api replica sees the same window; one upsert per counted attempt.
 */
export class Throttle {
  constructor(
    private readonly db: Db,
    /** Namespace so limiters sharing a key (an IP) do not share a counter. */
    private readonly name: string,
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Counts one attempt and says whether it is over the limit, in a single atomic upsert. Call it BEFORE the slow work
   * (password hash, LLM job): a separate check-then-count lets a burst of parallel requests all pass the check.
   */
  async hit(key: string): Promise<boolean> {
    const end = sql`now() + ${this.windowMs} * interval '1 millisecond'`;
    const live = sql`${rateLimits.until} > now()`;
    const [r] = await this.db
      .insert(rateLimits)
      .values({ key: `${this.name}:${key}`, n: 1, until: end })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { n: sql`case when ${live} then ${rateLimits.n} + 1 else 1 end`, until: sql`case when ${live} then ${rateLimits.until} else ${end} end` },
      })
      .returning({ n: rateLimits.n });
    // Bound the table under a spray of distinct keys without a separate job.
    if (Math.random() < 0.01) await this.db.delete(rateLimits).where(lte(rateLimits.until, sql`now()`));
    return r.n > this.max;
  }

  /** Gives back one attempt counted by hit() (a successful login is not a failure). */
  async undo(key: string): Promise<void> {
    await this.db
      .update(rateLimits)
      .set({ n: sql`greatest(${rateLimits.n} - 1, 0)` })
      .where(eq(rateLimits.key, `${this.name}:${key}`));
  }

  async reset(key: string): Promise<void> {
    await this.db.delete(rateLimits).where(eq(rateLimits.key, `${this.name}:${key}`));
  }
}
