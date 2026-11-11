import { z } from 'zod';

// Per-order private GitHub repo, created by workers/repo-worker through the GitHub App.

/** Mock order ids today (GC-3428); backend orders will keep the same shape. */
export const OrderIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,40}$/);

export const RepoCreateSchema = z.object({
  orderId: OrderIdSchema,
  title: z.string().trim().min(1).max(200),
  /** Committed as CLAUDE.md at the repo root. */
  claudeMd: z.string().max(64_000),
});

export const RepoStatusSchema = z.enum(['PENDING', 'READY', 'FAILED']);

export const RepoCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string(),
  url: z.string(),
  pushedAt: z.string(),
});

export const OrderRepoSchema = z.object({
  orderId: z.string(),
  status: RepoStatusSchema,
  repoFullName: z.string().nullable(),
  htmlUrl: z.string().nullable(),
  cloneUrl: z.string().nullable(),
  /** GitHub login invited with push access; null when the coder has no GitHub account linked. */
  collaborator: z.string().nullable(),
  error: z.string().nullable(),
  /** Newest first, from the push webhook. */
  commits: z.array(RepoCommitSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RepoCreate = z.input<typeof RepoCreateSchema>;
export type RepoCommit = z.infer<typeof RepoCommitSchema>;
export type OrderRepo = z.infer<typeof OrderRepoSchema>;
