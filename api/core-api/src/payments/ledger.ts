import { milestoneShare, payoutOf } from '@grabcode/contracts/schemas';

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

/** Milestone `index` approved: its share of the price leaves escrow, the coder gets the same share of the payout, the platform the rest. */
export function releaseEntries(orderId: string, priceVnd: number, weights: number[], index: number, coderUserId: string): Entry[] {
  const amount = milestoneShare(priceVnd, weights, index);
  const payout = milestoneShare(payoutOf(priceVnd), weights, index);
  return [
    { account: escrowOf(orderId), amountVnd: -amount },
    { account: coderOf(coderUserId), amountVnd: payout },
    { account: PLATFORM, amountVnd: amount - payout },
  ];
}

export const isBalanced = (entries: Entry[]) => entries.length > 0 && entries.reduce((s, e) => s + e.amountVnd, 0) === 0;
