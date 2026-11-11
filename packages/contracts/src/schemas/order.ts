import { z } from 'zod';
import { SEED_TEMPLATES } from '../mock/seedData';
import { AIBriefSchema, OrderTierSchema } from './brief';

// Order core (S1). Postgres core.orders is the source of truth; every status change also writes an outbox event.

export const OrderStatusSchema = z.enum(['DRAFT', 'FUNDED', 'DISPATCHED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'DISPUTED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** Who may move an order along an edge. SYSTEM edges are taken by core-api itself, never via the API. */
export type OrderActor = 'CUSTOMER' | 'CODER' | 'SYSTEM';

/**
 * Allowed edges -> actor. Anything not listed is rejected with 409.
 * DELIVERED -> IN_PROGRESS is the customer's "request revision".
 * DRAFT -> FUNDED happens when the escrow ledger holds the full price (SePay webhook), never by request.
 * FUNDED -> DISPATCHED (first wave sent) and DISPATCHED -> IN_PROGRESS (a coder accepts an offer) are taken by dispatch.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, OrderActor>>> = {
  DRAFT: { FUNDED: 'SYSTEM' },
  FUNDED: { DISPATCHED: 'SYSTEM' },
  DISPATCHED: { IN_PROGRESS: 'SYSTEM' },
  IN_PROGRESS: { DELIVERED: 'CODER' },
  DELIVERED: { ACCEPTED: 'CUSTOMER', DISPUTED: 'CUSTOMER', IN_PROGRESS: 'CUSTOMER' },
  ACCEPTED: {},
  DISPUTED: {},
};

export const transitionActor = (from: OrderStatus, to: OrderStatus): OrderActor | undefined => ORDER_TRANSITIONS[from][to];

// ---- Pricing (server computes the price; the web shows the same estimate before checkout) ----

export const TIER_PRICING: Record<z.infer<typeof OrderTierSchema>, { basePriceVnd: number; hours: number }> = {
  EXPRESS: { basePriceVnd: 2_800_000, hours: 3 },
  STANDARD: { basePriceVnd: 2_000_000, hours: 8 },
  PRO: { basePriceVnd: 6_500_000, hours: 24 },
  TEMPLATE: { basePriceVnd: 2_200_000, hours: 2 },
};

/** Share of the order price paid out to the coder on acceptance. */
export const CODER_PAYOUT_RATE = 0.7;
export const payoutOf = (priceVnd: number) => Math.round((priceVnd * CODER_PAYOUT_RATE) / 1000) * 1000;

export function estimateOrder(tier: z.infer<typeof OrderTierSchema>, prompt: string, templateId?: string | null) {
  const tpl = SEED_TEMPLATES.find((t) => t.id === templateId);
  let price = TIER_PRICING[tier].basePriceVnd;
  let eta = TIER_PRICING[tier].hours;
  if (tier === 'TEMPLATE' && tpl) {
    price = tpl.basePriceVnd;
    eta = tpl.etaHours;
  } else if (tpl) {
    price = Math.round(price * 0.85);
  }
  // Longer prompts imply more scope: +100k per 80 chars beyond 120, capped.
  const extra = Math.min(Math.max(0, prompt.length - 120) / 80, 10);
  price += Math.round(extra) * 100000;
  return { priceVnd: Math.round(price / 10000) * 10000, etaHours: eta };
}

// ---- Coder stats (shown in the coder app header) ----

export const CoderTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']);
export const CoderStatsSchema = z.object({
  tier: CoderTierSchema,
  completedOrders: z.number().int(),
  /** null until customer reviews exist (S4). */
  rating: z.number().nullable(),
});
export type CoderStats = z.infer<typeof CoderStatsSchema>;

/** Tier from accepted orders; admin overrides come with S7. */
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
});

/** Body of POST /v1/orders/{id}/transitions. */
export const OrderTransitionSchema = z.object({ status: OrderStatusSchema });

/** Body of POST /v1/orders/{id}/milestones/{milestoneId}/complete. */
export const MilestoneCompleteSchema = z.object({ commitHash: z.string().regex(/^[0-9a-f]{7,40}$/).nullish() });

export const OrderListQuerySchema = z.object({
  /** mine: customer's own + coder's assigned orders. Coders get new orders as offers (GET /v1/me/offers). */
  scope: z.enum(['mine']).default('mine'),
});

export const OrderPartySchema = z.object({ id: z.string().uuid(), name: z.string(), avatarUrl: z.string().nullable() });

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
  /** What the coder receives on ACCEPTED. */
  payoutVnd: z.number().int(),
  etaHours: z.number().int(),
  customer: OrderPartySchema,
  coder: OrderPartySchema.extend({ stats: CoderStatsSchema }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrderListSchema = z.object({ orders: z.array(OrderSchema) });

export type OrderCreate = z.input<typeof OrderCreateSchema>;
export type OrderDto = z.infer<typeof OrderSchema>;
export type OrderList = z.infer<typeof OrderListSchema>;
