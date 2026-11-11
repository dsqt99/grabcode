import type { AIBrief } from '@grabcode/contracts';
import { transitionActor, type OrderStatus } from '@grabcode/contracts/schemas';

// Pure order rules (no DB) so the state machine is unit-testable. The service applies the result inside a row lock.

export interface Denied {
  denied: 403 | 409;
  message: string;
}
interface OrderState {
  status: OrderStatus;
  customerUserId: string;
  coderUserId: string | null;
  brief: AIBrief;
}
interface Actor {
  id: string;
  roles: string[];
}

/** Checks edge + actor for `to`; returns the coder that owns the order afterwards, or why it is refused. */
export function planTransition(o: OrderState, user: Actor, to: OrderStatus): Denied | { coderUserId: string | null } {
  const actor = transitionActor(o.status, to);
  if (!actor || actor === 'SYSTEM') return { denied: 409, message: `Cannot move order from ${o.status} to ${to}` };
  if (actor === 'CUSTOMER') {
    return o.customerUserId === user.id ? { coderUserId: o.coderUserId } : { denied: 403, message: 'Only the customer can do this' };
  }
  if (o.status === 'DISPATCHED') {
    // shortcut: first coder to claim wins until S3 matching sends wave offers.
    if (!user.roles.includes('CODER')) return { denied: 403, message: 'Missing CODER role' };
    if (user.id === o.customerUserId) return { denied: 403, message: 'Cannot take your own order' };
    return { coderUserId: user.id };
  }
  if (o.coderUserId !== user.id) return { denied: 403, message: 'Only the assigned coder can do this' };
  if (to === 'DELIVERED' && o.brief.milestones.some((m) => m.status !== 'COMPLETED')) {
    return { denied: 409, message: 'Complete every milestone before delivering' };
  }
  return { coderUserId: o.coderUserId };
}

/** Marks `milestoneId` COMPLETED (must be the first unfinished one) and starts the next. */
export function completeMilestone(o: OrderState, user: Actor, milestoneId: string, commitHash: string | null, now: string): Denied | AIBrief {
  if (o.coderUserId !== user.id) return { denied: 403, message: 'Only the assigned coder can do this' };
  if (o.status !== 'IN_PROGRESS') return { denied: 409, message: `Order is ${o.status}, not IN_PROGRESS` };
  const ms = o.brief.milestones;
  const idx = ms.findIndex((m) => m.status !== 'COMPLETED');
  if (idx < 0 || ms[idx].id !== milestoneId) return { denied: 409, message: 'Milestones must be completed in order' };
  const milestones = ms.map((m, i) =>
    i === idx
      ? { ...m, status: 'COMPLETED' as const, completedAt: now, ...(commitHash ? { commitHash } : {}) }
      : i === idx + 1
        ? { ...m, status: 'IN_PROGRESS' as const }
        : m,
  );
  return { ...o.brief, milestones };
}

export const isDenied = (r: object): r is Denied => 'denied' in r;
