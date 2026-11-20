import { z } from 'zod';

// Escrow ledger (S2). Customers pay by bank transfer (VietQR). An admin confirms the money arrived
// (POST /v1/admin/orders/{id}/confirm-payment); optionally a SePay webhook does it automatically.
// Double-entry: every ledger tx is a set of entries summing to 0. Accounts:
//   bank:sepay         money that arrived in the receiving bank account, whoever confirmed it (goes negative = what we hold for others)
//   escrow:<orderId>   held for an order until acceptance
//   coder:<userId>     coder earnings (wallet)
//   platform:revenue   platform share of accepted orders
//   suspense           transfers that match no order (manual reconciliation)

/** Transfer content the customer must use. Banks often drop '-', so the code has none: GC-1006 -> GC1006. */
export const paymentCodeOf = (orderId: string) => orderId.replace('-', '');

/** Order id from SePay's detected `code` or, failing that, the raw transfer content. */
export function orderIdFromTransfer(code: string | null | undefined, content: string): string | null {
  const m = /GC-?(\d+)/i.exec(code || '') ?? /GC-?(\d+)/i.exec(content);
  return m ? `GC-${m[1]}` : null;
}

/** SePay webhook body (https://docs.sepay.vn/tich-hop-webhooks.html). Extra fields are ignored. */
export const SepayWebhookSchema = z.object({
  id: z.number().int(),
  gateway: z.string(),
  transactionDate: z.string(),
  accountNumber: z.string(),
  code: z.string().nullish(),
  content: z.string().default(''),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number().int().nonnegative(),
  referenceCode: z.string().nullish(),
});
export type SepayWebhook = z.infer<typeof SepayWebhookSchema>;

/** GET /v1/orders/{id}/payment (customer only). */
export const PaymentInstructionsSchema = z.object({
  orderId: z.string(),
  priceVnd: z.number().int(),
  paidVnd: z.number().int(),
  /** Still to transfer; 0 once funded. */
  dueVnd: z.number().int(),
  /** Exact transfer content (payment code). */
  content: z.string(),
  /** null when the receiving account is not configured (PAYMENT_* env). qrUrl: VietQR image with amount + content filled in. */
  bank: z.object({ name: z.string(), accountNumber: z.string(), accountName: z.string(), qrUrl: z.string() }).nullable(),
  /** true: a SePay webhook confirms transfers automatically; false: an admin confirms them by hand. */
  autoConfirm: z.boolean(),
  /** Dev only: POST /v1/payments/dev-deposit is available. */
  devDeposit: z.boolean(),
});
export type PaymentInstructions = z.infer<typeof PaymentInstructionsSchema>;

/** Body of POST /v1/payments/dev-deposit (simulates the SePay webhook for the remaining amount). */
export const DevDepositSchema = z.object({ orderId: z.string() });

/** ADJUST: admin moves a suspense deposit onto an order. REFUND: back to the customer. PAYOUT: coder withdrawal. */
export const LedgerKindSchema = z.enum(['DEPOSIT', 'RELEASE', 'REFUND', 'PAYOUT', 'ADJUST']);
export type LedgerKind = z.infer<typeof LedgerKindSchema>;

/** GET /v1/me/wallet (coder earnings). */
export const WalletSchema = z.object({
  balanceVnd: z.number().int(),
  entries: z.array(
    z.object({ txId: z.string(), kind: LedgerKindSchema, orderId: z.string().nullable(), amountVnd: z.number().int(), createdAt: z.string() }),
  ),
});
export type Wallet = z.infer<typeof WalletSchema>;

/**
 * VietQR image (img.vietqr.io) prefilled with amount + transfer content; scanned by any Vietnamese banking app.
 * bankId: VietQR bank code or BIN (e.g. MB / 970422, VCB / 970436, TCB / 970407).
 */
export const vietQrUrl = (bankId: string, accountNumber: string, accountName: string, amountVnd: number, content: string) =>
  `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNumber)}-compact2.png?${new URLSearchParams({
    amount: String(amountVnd),
    addInfo: content,
    accountName,
  })}`;
