import { z } from 'zod';
import { AIBriefSchema } from './brief';
import { CoderTierSchema, OrderStatusSchema, RefundAccountSchema } from './order';
import { LedgerKindSchema } from './payment';
import { ChatMessageSchema } from './realtime';

// Admin portal (S7). Every /v1/admin/* route needs the ADMIN role (granted in the DB, never self-service).
// Money moves only through balanced ledger txs (see payment.ts for accounts).

// ---- Coders ----

export const AdminCoderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  githubLogin: z.string().nullable(),
  email: z.string().nullable(),
  /** Effective tier: tierOverride ?? computed from accepted orders. */
  tier: CoderTierSchema,
  tierOverride: CoderTierSchema.nullable(),
  /** Suspended coders get no offers. */
  suspended: z.boolean(),
  online: z.boolean(),
  completedOrders: z.number().int(),
  /** Wallet balance (coder:<id>). */
  balanceVnd: z.number().int(),
  createdAt: z.string(),
});
export type AdminCoder = z.infer<typeof AdminCoderSchema>;
export const AdminCoderListSchema = z.object({ coders: z.array(AdminCoderSchema) });
export type AdminCoderList = z.infer<typeof AdminCoderListSchema>;

/** PATCH /v1/admin/coders/{id}. tierOverride null = back to the computed tier. */
export const AdminCoderPatchSchema = z
  .object({ tierOverride: CoderTierSchema.nullable().optional(), suspended: z.boolean().optional() })
  .refine((b) => b.tierOverride !== undefined || b.suspended !== undefined, { message: 'Nothing to change' });
export type AdminCoderPatch = z.infer<typeof AdminCoderPatchSchema>;

// ---- Orders. view=attention (default): unpaid drafts waiting for a transfer, disputes, money left in escrow,
// paid orders no coder took for 30+ minutes. view=all: the latest orders in any status. ----

export const AdminOrderQuerySchema = z.object({ view: z.enum(['attention', 'all']).default('attention') });

export const AdminOrderSchema = z.object({
  id: z.string(),
  status: OrderStatusSchema,
  title: z.string(),
  priceVnd: z.number().int(),
  /** Coder's total share fixed on the order; with priceVnd it gives the dispute split (disputeCoderShare). */
  payoutVnd: z.number().int(),
  /** Everything deposited for the order. */
  paidVnd: z.number().int(),
  /** Still held in escrow:<id>. */
  escrowVnd: z.number().int(),
  disputeReason: z.string().nullable(),
  customerName: z.string(),
  /** So the admin can reach the customer about a transfer. */
  customerEmail: z.string().nullable(),
  coderName: z.string().nullable(),
  /** DRAFT -> FUNDED time; "waiting for a coder" (30 min) and auto refund (AUTO_REFUND_HOURS) count from here. */
  fundedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminOrder = z.infer<typeof AdminOrderSchema>;
export const AdminOrderListSchema = z.object({ orders: z.array(AdminOrderSchema) });
export type AdminOrderList = z.infer<typeof AdminOrderListSchema>;

/** GET /v1/admin/orders/{id} (read only): everything needed to judge a dispute or a payment question. */
export const AdminOrderDetailSchema = z.object({
  order: AdminOrderSchema,
  prompt: z.string(),
  /** Milestones with delivery links, notes, submit / approve times. */
  brief: AIBriefSchema,
  refundAccount: RefundAccountSchema.nullable(),
  /** Order chat, oldest first. */
  messages: z.array(ChatMessageSchema),
  /** Every ledger tx of the order, oldest first. */
  ledger: z.array(
    z.object({
      txId: z.string(),
      kind: LedgerKindSchema,
      entries: z.array(z.object({ account: z.string(), amountVnd: z.number().int() })),
      /** Bank reference / note recorded with the tx, when any. */
      reference: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type AdminOrderDetail = z.infer<typeof AdminOrderDetailSchema>;

/**
 * POST /v1/admin/orders/{id}/resolve (DISPUTED -> RESOLVED). `refundVnd` of the escrow goes back to the customer,
 * the rest is released like a milestone (coder payout share, platform fee).
 */
export const DisputeResolveSchema = z.object({ refundVnd: z.number().int().min(0), note: z.string().trim().max(2000).optional() });
export type DisputeResolve = z.infer<typeof DisputeResolveSchema>;

/**
 * POST /v1/admin/orders/{id}/confirm-payment: the admin saw the transfer in the bank app and books it. Only DRAFT orders.
 * `reference` = bank transaction code (mã giao dịch); the same reference twice on one order is booked once (409).
 */
export const ConfirmPaymentSchema = z.object({
  amountVnd: z.number().int().min(1000).max(1_000_000_000),
  reference: z.string().trim().min(3).max(100),
});
export type ConfirmPayment = z.infer<typeof ConfirmPaymentSchema>;

// POST /v1/admin/orders/{id}/refund (no body): refunds what escrow still holds. DRAFT -> CANCELLED; on a closed
// order (ACCEPTED / RESOLVED / CANCELLED) it refunds the overpayment.

// ---- Refunds to transfer by hand. Every ledger tx that books money back to a customer (refund / auto refund of an
// order, suspense refund, refund part of a dispute split) opens one PENDING row; the admin transfers the money and
// closes it with the bank reference. ----

export const RefundStatusSchema = z.enum(['PENDING', 'PAID']);
export const RefundSchema = z.object({
  id: z.string().uuid(),
  /** The ledger tx that booked the refund. */
  txId: z.string(),
  /** null for a suspense refund (transfer matched no order): pay back the sender from the bank statement. */
  orderId: z.string().nullable(),
  amountVnd: z.number().int(),
  status: RefundStatusSchema,
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  /** Entered by the customer on the order page; null = ask the customer for it. */
  refundAccount: RefundAccountSchema.nullable(),
  /** Suspense refunds: the original transfer content, to find the sender. */
  transferContent: z.string().nullable(),
  /** Bank reference of the outgoing transfer, set when PAID. */
  reference: z.string().nullable(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
});
export type Refund = z.infer<typeof RefundSchema>;
export const RefundQuerySchema = z.object({ status: z.enum(['PENDING', 'all']).default('PENDING') });
export const RefundListSchema = z.object({ refunds: z.array(RefundSchema) });
export type RefundList = z.infer<typeof RefundListSchema>;

/**
 * POST /v1/admin/refunds/{id}/paid: the admin transferred the money. A bank reference closes one refund only (409 when
 * it is already used, or the refund is already PAID).
 */
export const RefundPaidSchema = z.object({ reference: z.string().trim().min(3).max(100) });
export type RefundPaid = z.infer<typeof RefundPaidSchema>;

// ---- Suspense (transfers that matched no order) ----

export const SuspenseItemSchema = z.object({
  /** The DEPOSIT tx parked in suspense. */
  txId: z.string(),
  amountVnd: z.number().int(),
  /** Transfer content as sent by the bank (from the SePay body). */
  content: z.string(),
  createdAt: z.string(),
});
export type SuspenseItem = z.infer<typeof SuspenseItemSchema>;
export const SuspenseListSchema = z.object({ items: z.array(SuspenseItemSchema) });
export type SuspenseList = z.infer<typeof SuspenseListSchema>;

/** POST /v1/admin/suspense/{txId}/resolve. orderId: move onto that order (may fund it); null: refund to the sender. */
export const SuspenseResolveSchema = z.object({ orderId: z.string().nullable() });
export type SuspenseResolve = z.infer<typeof SuspenseResolveSchema>;

// ---- Coder payouts (withdraw wallet to bank, approved by hand) ----

export const PayoutStatusSchema = z.enum(['PENDING', 'PAID', 'REJECTED']);
export const PayoutSchema = z.object({
  id: z.string().uuid(),
  coderUserId: z.string().uuid(),
  coderName: z.string(),
  amountVnd: z.number().int(),
  /** Free text: bank, account number, holder. */
  bankAccount: z.string(),
  status: PayoutStatusSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type Payout = z.infer<typeof PayoutSchema>;
export const PayoutListSchema = z.object({ payouts: z.array(PayoutSchema) });
export type PayoutList = z.infer<typeof PayoutListSchema>;

/** POST /v1/me/payouts (coder). Amount must fit the wallet minus other pending requests. */
export const PayoutCreateSchema = z.object({
  amountVnd: z.number().int().min(10_000),
  bankAccount: z.string().trim().min(5).max(200),
});
export type PayoutCreate = z.infer<typeof PayoutCreateSchema>;

/** POST /v1/admin/payouts/{id}/decide. approve = the admin already sent the money; the ledger debits the wallet. */
export const PayoutDecisionSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() });
export type PayoutDecision = z.infer<typeof PayoutDecisionSchema>;

// ---- Worker / queue monitor ----

export const MonitorSchema = z.object({
  /** core.outbox rows not yet relayed to NATS (outbox-relay down if this grows). */
  outboxPending: z.number().int(),
  outboxOldestSeconds: z.number().int().nullable(),
  /** public.centrifugo_outbox rows (Centrifugo consumer down if this grows). */
  realtimePending: z.number().int(),
  failedJobs: z.array(
    z.object({
      /** brief jobs are not retried: the customer just generates again on the web. */
      kind: z.enum(['brief', 'repo', 'sandbox']),
      id: z.string(),
      orderId: z.string().nullable(),
      error: z.string().nullable(),
      updatedAt: z.string(),
      /** POST /v1/admin/jobs/{kind}/{orderId}/retry is available (repo, sandbox). */
      retryable: z.boolean(),
    }),
  ),
  /** JetStream durable consumers; null when NATS is unreachable. */
  consumers: z
    .array(z.object({ name: z.string(), pending: z.number().int(), ackPending: z.number().int(), redelivered: z.number().int() }))
    .nullable(),
});
export type Monitor = z.infer<typeof MonitorSchema>;
