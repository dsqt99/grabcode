import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderIdFromTransfer, paymentCodeOf, payoutOf } from '@grabcode/contracts/schemas';
import { BANK, PLATFORM, SUSPENSE, coderOf, depositEntries, escrowOf, isBalanced, releaseEntries } from './ledger';

test('deposit and release always balance', () => {
  for (const amount of [1, 10_000, 2_800_000, 6_543_210]) {
    assert.ok(isBalanced(depositEntries('GC-1', amount)));
    assert.ok(isBalanced(depositEntries(null, amount)));
    assert.ok(isBalanced(releaseEntries('GC-1', amount, 'u')));
  }
  assert.ok(!isBalanced([]));
  assert.ok(!isBalanced([{ account: BANK, amountVnd: -1 }]));
});

test('deposit goes to the order escrow, unmatched to suspense', () => {
  assert.deepEqual(depositEntries('GC-7', 500).map((e) => e.account), [BANK, escrowOf('GC-7')]);
  assert.equal(depositEntries(null, 500)[1].account, SUSPENSE);
});

test('release pays the coder the payout and the platform the rest', () => {
  const e = releaseEntries('GC-7', 2_800_000, 'k');
  assert.deepEqual(e, [
    { account: escrowOf('GC-7'), amountVnd: -2_800_000 },
    { account: coderOf('k'), amountVnd: payoutOf(2_800_000) },
    { account: PLATFORM, amountVnd: 2_800_000 - payoutOf(2_800_000) },
  ]);
});

test('payment code round-trips through bank transfer content', () => {
  assert.equal(paymentCodeOf('GC-1006'), 'GC1006');
  assert.equal(orderIdFromTransfer('GC1006', 'whatever'), 'GC-1006');
  assert.equal(orderIdFromTransfer(null, 'NGUYEN VAN A chuyen tien gc1006 FT123'), 'GC-1006');
  assert.equal(orderIdFromTransfer('', 'GC-42 thanh toan'), 'GC-42');
  assert.equal(orderIdFromTransfer(null, 'chuyen tien'), null);
});
