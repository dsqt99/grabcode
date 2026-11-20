import { z } from 'zod';
import { AIBriefSchema, OrderTierSchema, QaResultSchema } from './brief';
import { OrderStatusSchema, type OrderStatus } from './order';
import { OrderIdSchema } from './repo';

// NATS JetStream contract. Every message is an envelope; event_id doubles as the
// JetStream Nats-Msg-Id (publish dedupe) and the processed_events key (consumer dedupe).

export const STREAM_NAME = 'GRABCODE';
export const STREAM_SUBJECTS = ['brief.>', 'repo.>', 'order.>', 'escrow.>', 'dispatch.>', 'milestone.>', 'qa.>', 'deploy.>', 'chat.>', 'payment.>'];

export const SUBJECTS = {
  BRIEF_REQUESTED: 'brief.requested',
  BRIEF_GENERATED: 'brief.generated',
  BRIEF_FAILED: 'brief.failed',
  REPO_REQUESTED: 'repo.requested',
  REPO_PROVISIONED: 'repo.provisioned',
  REPO_FAILED: 'repo.failed',
  REPO_HANDOVER_REQUESTED: 'repo.handover.requested',
  REPO_HANDED_OVER: 'repo.handed_over',
  ESCROW_DEPOSITED: 'escrow.deposited',
  ESCROW_RELEASED: 'escrow.released',
  ESCROW_REFUNDED: 'escrow.refunded',
  ESCROW_PAID_OUT: 'escrow.paid_out',
  DISPATCH_REQUESTED: 'dispatch.requested',
  DISPATCH_OFFERED: 'dispatch.offered',
  DISPATCH_ACCEPTED: 'dispatch.accepted',
  DISPATCH_EXPIRED: 'dispatch.expired',
  MILESTONE_SUBMITTED: 'milestone.submitted',
  MILESTONE_APPROVED: 'milestone.approved',
  MILESTONE_REJECTED: 'milestone.rejected',
  QA_REQUESTED: 'qa.requested',
  QA_COMPLETED: 'qa.completed',
  DEPLOY_REQUESTED: 'deploy.requested',
  DEPLOY_READY: 'deploy.ready',
  DEPLOY_FAILED: 'deploy.failed',
  DEPLOY_EXPIRED: 'deploy.expired',
  CHAT_POSTED: 'chat.posted',
  PAYMENT_REPORTED: 'payment.reported',
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

/** Emitted with order.accepted when the order has a READY repo: customer gets admin, coder drops to read-only. */
export const RepoHandoverRequestedEventSchema = envelope(
  SUBJECTS.REPO_HANDOVER_REQUESTED,
  z.object({
    orderId: OrderIdSchema,
    repoFullName: z.string(),
    /** null = customer has no GitHub login: only the coder is downgraded. */
    customerGithubLogin: z.string().nullable(),
    coderGithubLogin: z.string().nullable(),
  }),
);

export const RepoHandedOverEventSchema = envelope(
  SUBJECTS.REPO_HANDED_OVER,
  z.object({ orderId: OrderIdSchema, customerGithubLogin: z.string().nullable() }),
);

export type RepoHandoverRequestedEvent = z.infer<typeof RepoHandoverRequestedEventSchema>;
export type RepoHandedOverEvent = z.infer<typeof RepoHandedOverEventSchema>;
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
  CANCELLED: 'order.cancelled',
  RESOLVED: 'order.resolved',
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

/** One per ledger tx. deposited: money arrived (held in escrow:<orderId>, or suspense when unmatched). released: a milestone's share paid out on approval (or a dispute split).
 * refunded: money sent back to the customer. paid_out: coder withdrawal to their bank. */
export const EscrowEventSchema = z.object({
  event_id: z.string(),
  type: z.enum([SUBJECTS.ESCROW_DEPOSITED, SUBJECTS.ESCROW_RELEASED, SUBJECTS.ESCROW_REFUNDED, SUBJECTS.ESCROW_PAID_OUT]),
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

/**
 * requested: order funded, waiting for a wave. offered: wave sent to coderUserIds.
 * accepted: coderUserIds[0] won the order. expired: these coders' offers timed out.
 */
export const DispatchEventSchema = z.object({
  event_id: z.string(),
  type: z.enum([SUBJECTS.DISPATCH_REQUESTED, SUBJECTS.DISPATCH_OFFERED, SUBJECTS.DISPATCH_ACCEPTED, SUBJECTS.DISPATCH_EXPIRED]),
  occurred_at: z.string(),
  data: z.object({
    orderId: z.string(),
    /** 0 for requested. */
    wave: z.number().int().nonnegative(),
    coderUserIds: z.array(z.string().uuid()),
  }),
});
export type DispatchEvent = z.infer<typeof DispatchEventSchema>;

/** A party posted in the order chat. to*UserId = the other party on that side (null when it is the sender or unassigned). preview = first 120 chars. */
export const ChatPostedEventSchema = envelope(
  SUBJECTS.CHAT_POSTED,
  z.object({
    orderId: z.string(),
    senderName: z.string(),
    toCustomerUserId: z.string().uuid().nullable(),
    toCoderUserId: z.string().uuid().nullable(),
    preview: z.string().max(120),
  }),
);
export type ChatPostedEvent = z.infer<typeof ChatPostedEventSchema>;

/**
 * The customer pressed "Tôi đã chuyển khoản" on a DRAFT order (once per order). Nothing is booked: an admin still checks the
 * bank and confirms the payment. Consumed by the admin alert channel (P0-4).
 */
export const PaymentReportedEventSchema = envelope(
  SUBJECTS.PAYMENT_REPORTED,
  z.object({
    orderId: z.string(),
    customerUserId: z.string().uuid(),
    /** Still to transfer when reported. */
    dueVnd: z.number().int().nonnegative(),
    /** Transfer content the admin looks for in the bank app (GC1006). */
    content: z.string(),
  }),
);
export type PaymentReportedEvent = z.infer<typeof PaymentReportedEventSchema>;

/**
 * submitted: coder handed in a milestone (notifier tells the customer to review it). approved: customer accepted it, releasedVnd
 * left escrow and payoutVnd of it went to the coder's wallet. rejected: revision asked (note). notifier tells the coder about both.
 */
export const MilestoneEventSchema = z.object({
  event_id: z.string(),
  type: z.enum([SUBJECTS.MILESTONE_SUBMITTED, SUBJECTS.MILESTONE_APPROVED, SUBJECTS.MILESTONE_REJECTED]),
  occurred_at: z.string(),
  data: z.object({
    orderId: z.string(),
    milestoneId: z.string(),
    customerUserId: z.string().uuid(),
    coderUserId: z.string().uuid(),
    commitHash: z.string().nullable(),
    note: z.string().nullable(),
    /** 0 unless approved. */
    releasedVnd: z.number().int().nonnegative(),
    /** Coder's share of releasedVnd credited to the wallet; 0 unless approved. */
    payoutVnd: z.number().int().nonnegative(),
  }),
});
export type MilestoneEvent = z.infer<typeof MilestoneEventSchema>;

/** Emitted on milestone submit when the order repo is READY: qa-worker checks out the commit and runs the gate. */
export const QaRequestedEventSchema = envelope(
  SUBJECTS.QA_REQUESTED,
  z.object({
    orderId: OrderIdSchema,
    milestoneId: z.string(),
    repoFullName: z.string(),
    /** null = default branch head. */
    commitHash: z.string().nullable(),
  }),
);

/** Ignored by core-api when the milestone was resubmitted with another commit meanwhile. */
export const QaCompletedEventSchema = envelope(
  SUBJECTS.QA_COMPLETED,
  z.object({ orderId: OrderIdSchema, milestoneId: z.string(), result: QaResultSchema }),
);

/** Emitted on DELIVERED when the order repo is READY: deploy-worker builds the commit on Cloud Run. */
export const DeployRequestedEventSchema = envelope(
  SUBJECTS.DEPLOY_REQUESTED,
  z.object({ orderId: OrderIdSchema, repoFullName: z.string(), commitHash: z.string().nullable() }),
);

export const DeployReadyEventSchema = envelope(
  SUBJECTS.DEPLOY_READY,
  z.object({ orderId: OrderIdSchema, url: z.string(), expiresAt: z.string() }),
);

export const DeployFailedEventSchema = envelope(SUBJECTS.DEPLOY_FAILED, z.object({ orderId: OrderIdSchema, error: z.string() }));

/** Cleanup deleted the expired preview service. */
export const DeployExpiredEventSchema = envelope(SUBJECTS.DEPLOY_EXPIRED, z.object({ orderId: OrderIdSchema }));

export type QaRequestedEvent = z.infer<typeof QaRequestedEventSchema>;
export type QaCompletedEvent = z.infer<typeof QaCompletedEventSchema>;
export type DeployRequestedEvent = z.infer<typeof DeployRequestedEventSchema>;
export type DeployReadyEvent = z.infer<typeof DeployReadyEventSchema>;
export type DeployFailedEvent = z.infer<typeof DeployFailedEventSchema>;
export type DeployExpiredEvent = z.infer<typeof DeployExpiredEventSchema>;
