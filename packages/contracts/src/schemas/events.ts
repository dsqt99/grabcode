import { z } from 'zod';
import { AIBriefSchema, OrderTierSchema } from './brief';
import { OrderStatusSchema, type OrderStatus } from './order';
import { OrderIdSchema } from './repo';

// NATS JetStream contract. Every message is an envelope; event_id doubles as the
// JetStream Nats-Msg-Id (publish dedupe) and the processed_events key (consumer dedupe).

export const STREAM_NAME = 'GRABCODE';
export const STREAM_SUBJECTS = ['brief.>', 'repo.>', 'order.>', 'escrow.>'];

export const SUBJECTS = {
  BRIEF_REQUESTED: 'brief.requested',
  BRIEF_GENERATED: 'brief.generated',
  BRIEF_FAILED: 'brief.failed',
  REPO_REQUESTED: 'repo.requested',
  REPO_PROVISIONED: 'repo.provisioned',
  REPO_FAILED: 'repo.failed',
  ESCROW_DEPOSITED: 'escrow.deposited',
  ESCROW_RELEASED: 'escrow.released',
} as const;

const envelope = <T extends string, D extends z.ZodTypeAny>(type: T, data: D) =>
  z.object({
    event_id: z.string(),
    type: z.literal(type),
    occurred_at: z.string(),
    data,
  });

export const BriefRequestedEventSchema = envelope(
  SUBJECTS.BRIEF_REQUESTED,
  z.object({
    jobId: z.string().uuid(),
    prompt: z.string(),
    tier: OrderTierSchema,
    templateId: z.string().nullable(),
    framework: z.string(),
  }),
);

export const BriefGeneratedEventSchema = envelope(
  SUBJECTS.BRIEF_GENERATED,
  z.object({ jobId: z.string().uuid(), brief: AIBriefSchema, model: z.string() }),
);

export const BriefFailedEventSchema = envelope(
  SUBJECTS.BRIEF_FAILED,
  z.object({ jobId: z.string().uuid(), error: z.string(), retryable: z.boolean() }),
);

export type BriefRequestedEvent = z.infer<typeof BriefRequestedEventSchema>;
export type BriefGeneratedEvent = z.infer<typeof BriefGeneratedEventSchema>;
export type BriefFailedEvent = z.infer<typeof BriefFailedEventSchema>;

export const RepoRequestedEventSchema = envelope(
  SUBJECTS.REPO_REQUESTED,
  z.object({
    orderId: OrderIdSchema,
    title: z.string(),
    /** Repo name inside GITHUB_ORG, e.g. gc-3428. */
    repoName: z.string(),
    /** Invited with push access; null = no GitHub account linked yet. */
    coderGithubLogin: z.string().nullable(),
    claudeMd: z.string(),
  }),
);

export const RepoProvisionedEventSchema = envelope(
  SUBJECTS.REPO_PROVISIONED,
  z.object({
    orderId: OrderIdSchema,
    repoFullName: z.string(),
    htmlUrl: z.string(),
    cloneUrl: z.string(),
    defaultBranch: z.string(),
    collaborator: z.string().nullable(),
  }),
);

export const RepoFailedEventSchema = envelope(
  SUBJECTS.REPO_FAILED,
  z.object({ orderId: OrderIdSchema, error: z.string(), retryable: z.boolean() }),
);

export type RepoRequestedEvent = z.infer<typeof RepoRequestedEventSchema>;
export type RepoProvisionedEvent = z.infer<typeof RepoProvisionedEventSchema>;
export type RepoFailedEvent = z.infer<typeof RepoFailedEventSchema>;

/** Subject emitted when an order enters a status (DELIVERED -> IN_PROGRESS revision emits order.started again). */
export const ORDER_SUBJECTS = {
  DRAFT: 'order.created',
  FUNDED: 'order.funded',
  DISPATCHED: 'order.dispatched',
  IN_PROGRESS: 'order.started',
  DELIVERED: 'order.delivered',
  ACCEPTED: 'order.accepted',
  DISPUTED: 'order.disputed',
} as const satisfies Record<OrderStatus, string>;

export const OrderEventSchema = z.object({
  event_id: z.string(),
  type: z.enum(Object.values(ORDER_SUBJECTS) as [string, ...string[]]),
  occurred_at: z.string(),
  data: z.object({
    orderId: z.string(),
    status: OrderStatusSchema,
    /** null for order.created. */
    from: OrderStatusSchema.nullable(),
    customerUserId: z.string().uuid(),
    coderUserId: z.string().uuid().nullable(),
  }),
});

export type OrderEvent = z.infer<typeof OrderEventSchema>;

/** One per ledger tx. deposited: money arrived (held in escrow:<orderId>, or suspense when unmatched). released: paid out on ACCEPTED. */
export const EscrowEventSchema = z.object({
  event_id: z.string(),
  type: z.enum([SUBJECTS.ESCROW_DEPOSITED, SUBJECTS.ESCROW_RELEASED]),
  occurred_at: z.string(),
  data: z.object({
    txId: z.string(),
    orderId: z.string().nullable(),
    amountVnd: z.number().int(),
    /** Escrow balance of the order after this tx. */
    escrowVnd: z.number().int(),
  }),
});
export type EscrowEvent = z.infer<typeof EscrowEventSchema>;
