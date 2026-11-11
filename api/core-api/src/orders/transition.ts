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
  if (o.coderUserId !== user.id) return { denied: 403, message: 'Only the assigned coder can do this' };
  if (to === 'DELIVERED' && o.brief.milestones.some((m) => m.status !== 'COMPLETED')) {
    return { denied: 409, message: 'Every milestone must be approved before delivering' };
  }
  return { coderUserId: o.coderUserId };
}

/** The milestone being worked on or reviewed: the first one not COMPLETED. */
const current = (b: AIBrief) => b.milestones.findIndex((m) => m.status !== 'COMPLETED');
const setAt = (b: AIBrief, i: number, patch: (m: AIBrief['milestones'][number]) => AIBrief['milestones'][number]): AIBrief => ({
  ...b,
  milestones: b.milestones.map((m, j) => (j === i ? patch(m) : m)),
});

/** Coder hands in the current milestone for review (only while IN_PROGRESS; one at a time, in order). */
export function submitMilestone(o: OrderState, user: Actor, milestoneId: string, commitHash: string | null, note: string | null, now: string): Denied | AIBrief {
  if (o.coderUserId !== user.id) return { denied: 403, message: 'Only the assigned coder can do this' };
  if (o.status !== 'IN_PROGRESS') return { denied: 409, message: `Order is ${o.status}, not IN_PROGRESS` };
  const idx = current(o.brief);
  if (idx < 0 || o.brief.milestones[idx].id !== milestoneId) return { denied: 409, message: 'Milestones must be submitted in order' };
  if (o.brief.milestones[idx].status === 'SUBMITTED') return { denied: 409, message: 'Milestone already submitted, waiting for review' };
  return setAt(o.brief, idx, ({ note: _old, commitHash: _c, ...m }) => ({
    ...m,
    status: 'SUBMITTED',
    submittedAt: now,
    ...(commitHash ? { commitHash } : {}),
    ...(note ? { note } : {}),
  }));
}

/**
 * Customer reviews the SUBMITTED milestone. approve -> COMPLETED and the next one starts (caller releases its escrow share);
 * reject -> back to IN_PROGRESS with the revision note. Refused while DISPUTED: the escrow is frozen.
 */
export function reviewMilestone(o: OrderState, user: Actor, milestoneId: string, approve: boolean, note: string | null, now: string): Denied | { brief: AIBrief; index: number } {
  if (o.customerUserId !== user.id) return { denied: 403, message: 'Only the customer can do this' };
  if (o.status !== 'IN_PROGRESS') return { denied: 409, message: `Order is ${o.status}, not IN_PROGRESS` };
  const idx = current(o.brief);
  if (idx < 0 || o.brief.milestones[idx].id !== milestoneId || o.brief.milestones[idx].status !== 'SUBMITTED') {
    return { denied: 409, message: 'Milestone is not waiting for review' };
  }
  if (!approve) return { brief: setAt(o.brief, idx, (m) => ({ ...m, status: 'IN_PROGRESS', ...(note ? { note } : {}) })), index: idx };
  const done = setAt(o.brief, idx, (m) => ({ ...m, status: 'COMPLETED', completedAt: now }));
  return { brief: idx + 1 < done.milestones.length ? setAt(done, idx + 1, (m) => ({ ...m, status: 'IN_PROGRESS' })) : done, index: idx };
}

export const isDenied = (r: object): r is Denied => 'denied' in r;
