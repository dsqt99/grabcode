import { and, eq, gt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { SUBJECTS, type EscrowEvent } from '@grabcode/contracts/schemas';
import type { Db } from '../db/client';
import { ledgerEntries, ledgerTxs, outbox } from '../db/schema';
import { escrowOf, isBalanced, type Entry } from './ledger';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Conn = Db | Tx;

export async function balanceOf(db: Conn, account: string): Promise<number> {
  const [r] = await db.select({ v: sql<string>`coalesce(sum(${ledgerEntries.amountVnd}), 0)` }).from(ledgerEntries).where(eq(ledgerEntries.account, account));
  return Number(r.v);
}

/** Everything ever deposited for the order (escrow drops back to 0 after release). */
export async function paidFor(db: Conn, orderId: string): Promise<number> {
  const [r] = await db
    .select({ v: sql<string>`coalesce(sum(${ledgerEntries.amountVnd}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.account, escrowOf(orderId)), gt(ledgerEntries.amountVnd, 0)));
  return Number(r.v);
}

/**
 * Writes one balanced ledger tx + its escrow.* outbox event. Returns false when `id` was already posted
 * (SePay retries, double ACCEPTED), so callers can treat a repeat as a no-op.
 */
export async function postTx(tx: Tx, id: string, kind: 'DEPOSIT' | 'RELEASE', orderId: string | null, entries: Entry[], meta?: unknown) {
  if (!isBalanced(entries)) throw new Error(`Unbalanced ledger tx ${id}`);
  const [row] = await tx.insert(ledgerTxs).values({ id, kind, orderId, meta }).onConflictDoNothing().returning({ id: ledgerTxs.id });
  if (!row) return false;
  await tx.insert(ledgerEntries).values(entries.map((e) => ({ txId: id, account: e.account, amountVnd: e.amountVnd })));
  const event: EscrowEvent = {
    event_id: randomUUID(),
    type: kind === 'DEPOSIT' ? SUBJECTS.ESCROW_DEPOSITED : SUBJECTS.ESCROW_RELEASED,
    occurred_at: new Date().toISOString(),
    data: {
      txId: id,
      orderId,
      amountVnd: Math.abs(entries[0].amountVnd),
      escrowVnd: orderId ? await balanceOf(tx, escrowOf(orderId)) : 0,
    },
  };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
  return true;
}
