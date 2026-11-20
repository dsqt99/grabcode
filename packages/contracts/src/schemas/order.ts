import { z } from 'zod';
import { AIBriefSchema, OrderTierSchema } from './brief';
import { VnPhoneSchema } from './phone';

// Order core (S1). Postgres core.orders is the source of truth; every status change also writes an outbox event.

export const OrderStatusSchema = z.enum(['DRAFT', 'FUNDED', 'DISPATCHED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'DISPUTED', 'CANCELLED', 'RESOLVED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** Who may move an order along an edge. SYSTEM edges are taken by core-api itself, never via the API. */
export type OrderActor = 'CUSTOMER' | 'CODER' | 'SYSTEM';

/**
 * Allowed edges -> actor. Anything not listed is rejected with 409.
 * DELIVERED -> IN_PROGRESS is the customer's "request revision".
 * -> DISPUTED (customer, with a reason) freezes the escrow still held: no milestone can be approved or paid until an admin resolves it.
 * DRAFT -> FUNDED happens when the escrow ledger holds the full price (SePay webhook), never by request.
 * DRAFT -> CANCELLED (unpaid or part-paid order, deposit refunded) and DISPUTED -> RESOLVED (escrow split) are taken by an admin (S7).
 * FUNDED -> DISPATCHED (first wave sent) and FUNDED|DISPATCHED -> IN_PROGRESS (a coder accepts an offer or claims the job
 * from the board, POST /v1/jobs/{id}/claim) are taken by dispatch.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, OrderActor>>> = {
  DRAFT: { FUNDED: 'SYSTEM', CANCELLED: 'SYSTEM' },
  FUNDED: { DISPATCHED: 'SYSTEM', IN_PROGRESS: 'SYSTEM' },
  DISPATCHED: { IN_PROGRESS: 'SYSTEM' },
  IN_PROGRESS: { DELIVERED: 'CODER', DISPUTED: 'CUSTOMER' },
  DELIVERED: { ACCEPTED: 'CUSTOMER', DISPUTED: 'CUSTOMER', IN_PROGRESS: 'CUSTOMER' },
  ACCEPTED: {},
  DISPUTED: { RESOLVED: 'SYSTEM' },
  CANCELLED: {},
  RESOLVED: {},
};

export const transitionActor = (from: OrderStatus, to: OrderStatus): OrderActor | undefined => ORDER_TRANSITIONS[from][to];

// ---- Coder stats (shown in the coder app header) ----

export const CoderTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']);
export const CoderStatsSchema = z.object({
  tier: CoderTierSchema,
  completedOrders: z.number().int(),
  /** null until customer reviews exist (S4). */
  rating: z.number().nullable(),
});
export type CoderStats = z.infer<typeof CoderStatsSchema>;

/** Tier from accepted orders; an admin override (users.tier_override) wins. */
export const coderTierFor = (completed: number): z.infer<typeof CoderTierSchema> =>
  completed >= 50 ? 'DIAMOND' : completed >= 20 ? 'GOLD' : completed >= 5 ? 'SILVER' : 'BRONZE';

// ---- REST ----

export const OrderCreateSchema = z.object({
  prompt: z.string().trim().max(4000),
  tier: OrderTierSchema,
  templateId: z.string().max(100).nullish(),
  framework: z.string().max(200).default('Next.js 15 + Tailwind CSS'),
  /** Brief the customer reviewed (AI or fallback). Milestone statuses are reset to PENDING by the server. */
  brief: AIBriefSchema.extend({ milestones: AIBriefSchema.shape.milestones.min(1) }),
  /**
   * Saved on the customer's profile (P0-5). Required (400) while the profile has no valid Vietnamese mobile number,
   * i.e. on the first order; optional afterwards.
   */
  phone: VnPhoneSchema.optional(),
  /** The customer ticked "I agree to the terms and the refund policy" (P0-9). */
  acceptTerms: z.literal(true),
});

/** Body of POST /v1/orders/{id}/transitions. `reason` is required for DISPUTED (shown to the admin). */
export const OrderTransitionSchema = z
  .object({ status: OrderStatusSchema, reason: z.string().trim().max(2000).optional() })
  .refine((b) => b.status !== 'DISPUTED' || !!b.reason, { message: 'A reason is required to dispute', path: ['reason'] });

/** Absolute http(s) link (delivery links are rendered as <a href>, so no javascript: / data:). */
export const HttpUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => {
    try {
      return ['http:', 'https:'].includes(new URL(u).protocol);
    } catch {
      return false;
    }
  }, 'Must be an http(s) link');

/**
 * Body of POST /v1/orders/{id}/milestones/{milestoneId}/submit. The coder hands in a link (demo, repo, Drive file),
 * and/or a commit pushed to the order repo (GitHub App), and/or a note: at least one of them.
 */
export const MilestoneSubmitSchema = z
  .object({
    commitHash: z.string().regex(/^[0-9a-f]{7,40}$/).nullish(),
    deliveryUrl: HttpUrlSchema.nullish(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((b) => !!(b.commitHash || b.deliveryUrl || b.note), { message: 'Add a delivery link, a commit or a note', path: ['deliveryUrl'] });

/** Body of POST /v1/orders/{id}/milestones/{milestoneId}/reject (customer asks for changes). */
export const MilestoneRejectSchema = z.object({ note: z.string().trim().min(1).max(2000) });

/**
 * Escrow released when milestone `index` is approved: cumulative weight share, so the parts always add up to
 * exactly `total` (weights need not sum to 100). Same split for the coder payout.
 */
export function milestoneShare(total: number, weights: number[], index: number) {
  const ws = weights.some((w) => w > 0) ? weights : weights.map(() => 1);
  const sum = ws.reduce((s, w) => s + w, 0);
  const upTo = (n: number) => Math.round((total * ws.slice(0, n).reduce((s, w) => s + w, 0)) / sum);
  return upTo(index + 1) - upTo(index);
}

/**
 * Dispute split (S7): of what escrow still holds after `refundVnd` goes back to the customer, the coder gets the order's
 * payout ratio (rounded to 1,000 VND, never above the rest); the platform keeps the remainder.
 */
export function disputeCoderShare(escrowVnd: number, refundVnd: number, priceVnd: number, payoutVnd: number) {
  const rest = escrowVnd - refundVnd;
  return Math.min(Math.round((rest * payoutVnd) / priceVnd / 1000) * 1000, rest);
}

export const OrderListQuerySchema = z.object({
  /** mine: customer's own + coder's assigned orders. Coders find new orders in offers (GET /v1/me/offers) or the job board (GET /v1/jobs). */
  scope: z.enum(['mine']).default('mine'),
});

export const OrderPartySchema = z.object({ id: z.string().uuid(), name: z.string(), avatarUrl: z.string().nullable() });

/** Cloud Run preview of the delivered commit (deploy-worker). PENDING from DELIVERED until deploy.ready / deploy.failed. */
export const SandboxSchema = z.object({
  status: z.enum(['PENDING', 'READY', 'FAILED', 'EXPIRED']),
  url: z.string().nullable(),
  error: z.string().nullable(),
  /** Cleanup deletes the service after this. */
  expiresAt: z.string().nullable(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;

/**
 * Where the customer's money is, from the escrow ledger (VND). paid = everything deposited; held = still in escrow:<id>;
 * released = left escrow for approved milestones / dispute split (coder share + platform fee); refunded = booked back
 * to the customer (each refund is then transferred by hand, see admin refunds). paid = held + released + refunded.
 */
export const OrderMoneySchema = z.object({
  paidVnd: z.number().int(),
  heldVnd: z.number().int(),
  releasedVnd: z.number().int(),
  refundedVnd: z.number().int(),
});
export type OrderMoney = z.infer<typeof OrderMoneySchema>;

/**
 * GET / PUT /v1/orders/{id}/refund-account (customer only): the bank account a refund of this order is transferred to.
 * Shown to admins on the pending refund; never to the coder.
 */
export const RefundAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().regex(/^[0-9 ]{6,25}$/, 'Account number: digits only'),
  /** Holder name as printed by the bank (usually upper case, no accents). */
  accountName: z.string().trim().min(2).max(100),
});
export type RefundAccount = z.infer<typeof RefundAccountSchema>;
export const RefundAccountResponseSchema = z.object({ refundAccount: RefundAccountSchema.nullable() });
export type RefundAccountResponse = z.infer<typeof RefundAccountResponseSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  status: OrderStatusSchema,
  tier: OrderTierSchema,
  title: z.string(),
  prompt: z.string(),
  templateId: z.string().nullable(),
  framework: z.string(),
  brief: AIBriefSchema,
  priceVnd: z.number().int(),
  /** What the coder receives in total, fixed when the order is created (CODER_PAYOUT_RATE at that time). */
  payoutVnd: z.number().int(),
  money: OrderMoneySchema,
  /** When the escrow first held the full price (DRAFT -> FUNDED); the 30 min / AUTO_REFUND_HOURS clocks start here. */
  fundedAt: z.string().nullable(),
  etaHours: z.number().int(),
  /** Set when the customer disputes; read by admins (S7). */
  disputeReason: z.string().nullable(),
  /** null until the order is first DELIVERED with a READY repo. */
  sandbox: SandboxSchema.nullable(),
  customer: OrderPartySchema,
  coder: OrderPartySchema.extend({ stats: CoderStatsSchema }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrderListSchema = z.object({ orders: z.array(OrderSchema) });

export type OrderCreate = z.input<typeof OrderCreateSchema>;
export type OrderDto = z.infer<typeof OrderSchema>;
export type OrderList = z.infer<typeof OrderListSchema>;
