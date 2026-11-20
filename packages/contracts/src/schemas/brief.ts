import { z } from 'zod';

// Runtime contract for the brief-generation flow (web -> core-api -> brief-worker -> core-api).
// Generated OpenAPI / JSON Schema files under contracts/openapi and contracts/events come from these.

export const OrderTierSchema = z.enum(['EXPRESS', 'STANDARD', 'PRO', 'TEMPLATE']);

/** One QA Gate step (install, lint, typecheck, build, test, audit, secrets). */
export const QaCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['PASSED', 'FAILED', 'SKIPPED']),
  /** Tail of the step output, or why it was skipped. */
  detail: z.string(),
});

/**
 * QA Gate result of a submitted milestone commit (qa-worker). RUNNING until qa.completed arrives;
 * SKIPPED = not a Node project; ERROR = the gate itself could not run (clone / docker).
 */
export const QaResultSchema = z.object({
  status: z.enum(['RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'ERROR']),
  commitHash: z.string().nullable(),
  checks: z.array(QaCheckSchema),
  finishedAt: z.string().optional(),
});

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  weightPercent: z.number().int().min(0).max(100),
  /** IN_PROGRESS -> SUBMITTED (coder) -> COMPLETED (customer approves, releases this share of escrow) or back to IN_PROGRESS (revision). */
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED']),
  submittedAt: z.string().optional(),
  completedAt: z.string().optional(),
  commitHash: z.string().optional(),
  /** What the coder handed in for this milestone: demo, repo or file link (http/https only). */
  deliveryUrl: z.string().optional(),
  /** Coder's note on submit, or the customer's revision request. */
  note: z.string().optional(),
  /** QA Gate of the last submit; absent when the order has no repo. */
  qa: QaResultSchema.optional(),
});

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  text: z.string(),
  passed: z.boolean(),
});

export const AIBriefSchema = z.object({
  title: z.string(),
  scopeSummary: z.string(),
  features: z.array(z.string()),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  milestones: z.array(MilestoneSchema),
  claudeMdContent: z.string(),
});

export const BriefJobCreateSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  tier: OrderTierSchema,
  templateId: z.string().max(100).nullish(),
  framework: z.string().max(200).default('Next.js 15 + Tailwind CSS'),
});

export const BriefJobStatusSchema = z.enum(['PENDING', 'READY', 'FAILED']);

export const BriefJobSchema = z.object({
  id: z.string().uuid(),
  status: BriefJobStatusSchema,
  prompt: z.string(),
  tier: OrderTierSchema,
  templateId: z.string().nullable(),
  framework: z.string(),
  brief: AIBriefSchema.nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ErrorResponseSchema = z.object({
  message: z.string(),
  issues: z.array(z.unknown()).optional(),
});

export type BriefJobCreate = z.input<typeof BriefJobCreateSchema>;
export type BriefJob = z.infer<typeof BriefJobSchema>;
export type BriefJobStatus = z.infer<typeof BriefJobStatusSchema>;
