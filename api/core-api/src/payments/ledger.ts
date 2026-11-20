import { milestoneShare } from '@grabcode/contracts/schemas';

// Pure ledger rules (no DB) so they are unit-testable. Account names: see contracts/schemas/payment.ts.

export interface Entry {
  account: string;
  amountVnd: number;
}

export const BANK = 'bank:sepay';
export const PLATFORM = 'platform:revenue';
export const SUSPENSE = 'suspense';
export const escrowOf = (orderId: string) => `escrow:${orderId}`;
export const coderOf = (userId: string) => `coder:${userId}`;

/** Money in from the bank: held for the order, or parked in suspense when no order matches. */
export const depositEntries = (orderId: string | null, amountVnd: number): Entry[] => [
  { account: BANK, amountVnd: -amountVnd },
  { account: orderId ? escrowOf(orderId) : SUSPENSE, amountVnd },
];

/**
 * Milestone `index` approved: its share of the price leaves escrow, the coder gets the same share of the order's
 * payout (fixed at creation), the platform the rest.
 */
export function releaseEntries(orderId: string, priceVnd: number, payoutVnd: number, weights: number[], index: number, coderUserId: string): Entry[] {
  const amount = milestoneShare(priceVnd, weights, index);
  const payout = milestoneShare(payoutVnd, weights, index);
  return [
    { account: escrowOf(orderId), amountVnd: -amount },
    { account: coderOf(coderUserId), amountVnd: payout },
    { account: PLATFORM, amountVnd: amount - payout },
  ];
}

export const isBalanced = (entries: Entry[]) => entries.length > 0 && entries.reduce((s, e) => s + e.amountVnd, 0) === 0;

/** Money back out to the bank (customer refund, coder payout): debits `account`. */
export const payoutEntries = (account: string, amountVnd: number): Entry[] => [
  { account, amountVnd: -amountVnd },
  { account: BANK, amountVnd },
];

/** Moves money between internal accounts (a suspense deposit onto an order's escrow). */
export const moveEntries = (from: string, to: string, amountVnd: number): Entry[] => [
  { account: from, amountVnd: -amountVnd },
  { account: to, amountVnd },
];

/**
 * Dispute split (S7): the whole escrow leaves, `refundVnd` back to the customer, the rest released like a milestone
 * (coder gets the order's payout ratio of it, platform the fee). Zero legs are dropped. Caller checks 0 <= refundVnd <= escrowVnd.
 */
export function resolveEntries(orderId: string, escrowVnd: number, refundVnd: number, coderUserId: string, priceVnd: number, payoutVnd: number): Entry[] {
  const rest = escrowVnd - refundVnd;
  // Rounded to 1000 VND, which can exceed a tiny remainder.
  const coder = Math.min(Math.round((rest * payoutVnd) / priceVnd / 1000) * 1000, rest);
  const entries: Entry[] = [
    { account: escrowOf(orderId), amountVnd: -escrowVnd },
    { account: BANK, amountVnd: refundVnd },
    { account: coderOf(coderUserId), amountVnd: coder },
    { account: PLATFORM, amountVnd: rest - coder },
  ];
  return entries.filter((e) => e.amountVnd !== 0);
}
