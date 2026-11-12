/**
 * Failed-attempt counter per key (email, IP), fixed window: `max` failures inside `windowMs` blocks the key until the window ends.
 * shortcut: in-memory, per core-api instance; move to Redis when core-api runs more than one replica.
 */
export class Throttle {
  private readonly hits = new Map<string, { n: number; until: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  blocked(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    return !!h && h.until > now && h.n >= this.max;
  }

  fail(key: string, now = Date.now()): void {
    const h = this.hits.get(key);
    if (h && h.until > now) h.n++;
    else this.hits.set(key, { n: 1, until: now + this.windowMs });
    // Bound memory under a spray of distinct keys: drop expired windows.
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.until <= now) this.hits.delete(k);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
