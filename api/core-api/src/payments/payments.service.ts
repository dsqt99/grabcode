import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { paymentCodeOf, type PaymentInstructions, type Wallet } from '@grabcode/contracts/schemas';
import { DEV_LOGIN_ENABLED, SEPAY_ACCOUNT_NAME, SEPAY_ACCOUNT_NUMBER, SEPAY_BANK } from '../config';
import { DB, type Db } from '../db/client';
import { ledgerEntries, ledgerTxs, orders, users } from '../db/schema';
import { fundIfCovered } from '../orders/orders.service';
import { coderOf, depositEntries } from './ledger';
import { balanceOf, paidFor, postTx } from './ledger.db';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class PaymentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Books an incoming transfer. `txId` is the idempotency key (SePay id): a repeat returns false.
   * Unknown order -> suspense (manual reconciliation). Full price in escrow -> order funded + dispatched.
   */
  recordDeposit(txId: string, orderId: string | null, amountVnd: number, meta?: unknown): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [row] = orderId ? await tx.select().from(orders).where(eq(orders.id, orderId)).for('update') : [];
      const posted = await postTx(tx, txId, 'DEPOSIT', row?.id ?? null, depositEntries(row?.id ?? null, amountVnd), meta);
      if (posted && row) await fundIfCovered(tx, row);
      return posted;
    });
  }

  private async ownOrder(user: UserRow, orderId: string) {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!row || row.customerUserId !== user.id) throw new NotFoundException({ message: 'Order not found' });
    return row;
  }

  async instructions(user: UserRow, orderId: string): Promise<PaymentInstructions> {
    const row = await this.ownOrder(user, orderId);
    const paidVnd = await paidFor(this.db, row.id);
    const dueVnd = Math.max(0, row.priceVnd - paidVnd);
    const content = paymentCodeOf(row.id);
    const bank =
      SEPAY_BANK && SEPAY_ACCOUNT_NUMBER
        ? {
            name: SEPAY_BANK,
            accountNumber: SEPAY_ACCOUNT_NUMBER,
            accountName: SEPAY_ACCOUNT_NAME,
            qrUrl: `https://qr.sepay.vn/img?${new URLSearchParams({ acc: SEPAY_ACCOUNT_NUMBER, bank: SEPAY_BANK, amount: String(dueVnd), des: content })}`,
          }
        : null;
    return { orderId: row.id, priceVnd: row.priceVnd, paidVnd, dueVnd, content, bank, devDeposit: DEV_LOGIN_ENABLED };
  }

  /** Dev only: pretend the customer transferred the remaining amount. */
  async devDeposit(user: UserRow, orderId: string): Promise<PaymentInstructions> {
    const row = await this.ownOrder(user, orderId);
    const due = row.priceVnd - (await paidFor(this.db, row.id));
    if (due > 0) await this.recordDeposit(`dev:${randomUUID()}`, row.id, due, { source: 'dev' });
    return this.instructions(user, orderId);
  }

  async wallet(user: UserRow): Promise<Wallet> {
    const account = coderOf(user.id);
    const rows = await this.db
      .select({ txId: ledgerTxs.id, kind: ledgerTxs.kind, orderId: ledgerTxs.orderId, amountVnd: ledgerEntries.amountVnd, createdAt: ledgerTxs.createdAt })
      .from(ledgerEntries)
      .innerJoin(ledgerTxs, eq(ledgerTxs.id, ledgerEntries.txId))
      .where(eq(ledgerEntries.account, account))
      .orderBy(desc(ledgerTxs.createdAt))
      .limit(50);
    return {
      balanceVnd: await balanceOf(this.db, account),
      entries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  }
}
