import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import type { AIBrief } from '@grabcode/contracts';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { orders, users } from '../db/schema';

// In-process Postgres (PGlite) with every migration applied: DB tests run in CI without Docker.

export async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  // Same query builder API as the postgres-js driver the app uses.
  return db as unknown as Db;
}

export async function addUser(db: Db, roles: ('CUSTOMER' | 'CODER' | 'ADMIN')[], name = roles[0].toLowerCase()) {
  const [u] = await db.insert(users).values({ providerKey: `dev:${name}:${Math.random()}`, name, roles }).returning();
  return u;
}

export const brief = (weights = [20, 50, 30]): AIBrief => ({
  title: 'Web đặt bàn',
  scopeSummary: 'Đặt bàn quán cà phê',
  features: ['Đặt bàn'],
  inScope: [],
  outOfScope: [],
  acceptanceCriteria: [],
  milestones: weights.map((w, i) => ({ id: `M${i + 1}`, title: `Mốc ${i + 1}`, description: '', weightPercent: w, status: 'PENDING' as const })),
  claudeMdContent: '',
});

export async function addOrder(db: Db, customerUserId: string, patch: Partial<typeof orders.$inferInsert> = {}) {
  const [o] = await db
    .insert(orders)
    .values({ customerUserId, tier: 'STANDARD', title: 'Web đặt bàn', prompt: 'web đặt bàn', framework: 'Next.js', brief: brief(), priceVnd: 2_900_000, priceQuotedAt: new Date(), payoutVnd: 2_030_000, etaHours: 8, ...patch })
    .returning();
  return o;
}
