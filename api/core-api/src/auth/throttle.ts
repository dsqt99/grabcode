import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rateLimits } from '../db/schema';

/**
 * Failed-attempt counter per key (email, IP), fixed window: `max` failures inside `windowMs` blocks the key until the window ends.
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

  async blocked(key: string): Promise<boolean> {
    const [r] = await this.db
      .select({ n: rateLimits.n })
      .from(rateLimits)
      .where(and(eq(rateLimits.key, `${this.name}:${key}`), gt(rateLimits.until, sql`now()`)));
    return (r?.n ?? 0) >= this.max;
  }

  async fail(key: string): Promise<void> {
    const end = sql`now() + ${this.windowMs} * interval '1 millisecond'`;
    const live = sql`${rateLimits.until} > now()`;
    await this.db
      .insert(rateLimits)
      .values({ key: `${this.name}:${key}`, n: 1, until: end })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { n: sql`case when ${live} then ${rateLimits.n} + 1 else 1 end`, until: sql`case when ${live} then ${rateLimits.until} else ${end} end` },
      });
    // Bound the table under a spray of distinct keys without a separate job.
    if (Math.random() < 0.01) await this.db.delete(rateLimits).where(lte(rateLimits.until, sql`now()`));
  }

  async reset(key: string): Promise<void> {
    await this.db.delete(rateLimits).where(eq(rateLimits.key, `${this.name}:${key}`));
  }
}
