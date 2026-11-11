import { SEED_TEMPLATES } from './mock/seedData';
import type { OrderDto, OrderRepo } from './schemas';
import type { Order, OrderStatus } from './types/order';

/**
 * Maps the core-api order (S1 state machine) to the UI `Order` the POC components render.
 * shortcut: UI keeps its own status vocabulary; drop this adapter once components read OrderDto directly.
 */
export function toViewOrder(o: OrderDto, repo?: OrderRepo | null): Order {
  const allDone = o.brief.milestones.every((m) => m.status === 'COMPLETED');
  const status: Record<OrderDto['status'], OrderStatus> = {
    DRAFT: 'DRAFT',
    FUNDED: 'DISPATCHING',
    DISPATCHED: 'DISPATCHING',
    IN_PROGRESS: allDone ? 'QA_TESTING' : 'BUILDING',
    DELIVERED: 'DELIVERED',
    ACCEPTED: 'COMPLETED',
    DISPUTED: 'CANCELLED',
  };
  return {
    id: o.id,
    tier: o.tier,
    title: o.title,
    customerName: o.customer.name,
    customerPrompt: o.prompt,
    templateId: o.templateId ?? undefined,
    templateName: SEED_TEMPLATES.find((t) => t.id === o.templateId)?.title,
    framework: o.framework,
    priceVnd: o.priceVnd,
    // DRAFT = unpaid: the server only leaves DRAFT once the ledger escrow holds the full price.
    escrowStatus: o.status === 'DRAFT' ? 'UNPAID' : o.status === 'ACCEPTED' ? 'RELEASED' : 'ESCROW_LOCKED',
    status: status[o.status],
    brief: o.brief,
    // rating 0 means unknown (no reviews before S4).
    assignedCoder: o.coder
      ? {
          id: o.coder.id,
          name: o.coder.name,
          avatar: o.coder.avatarUrl ?? '',
          tier: o.coder.stats.tier,
          rating: o.coder.stats.rating ?? 0,
          completedOrders: o.coder.stats.completedOrders,
          walletBalanceVnd: 0,
          isOnline: true,
          specialties: [],
        }
      : undefined,
    repoUrl: repo?.htmlUrl ?? undefined,
    demoUrl: o.sandbox?.status === 'READY' ? (o.sandbox.url ?? undefined) : undefined,
    sandboxStatus: o.sandbox?.status,
    sandboxError: o.sandbox?.error ?? undefined,
    createdAt: o.createdAt,
    etaHours: o.etaHours,
    completedAt: o.status === 'ACCEPTED' ? o.updatedAt : undefined,
    disputeReason: o.status === 'DISPUTED' ? (o.disputeReason ?? '') : undefined,
    commits: (repo?.commits ?? [])
      .map((c) => ({ hash: c.sha.slice(0, 7), message: c.message, timestamp: c.pushedAt, author: c.author }))
      .reverse(), // repo is newest-first, the terminal log reads oldest-first
  };
}
