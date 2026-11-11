import assert from 'node:assert/strict';
import { test } from 'node:test';
import { milestoneShare, orderIdFromTransfer, paymentCodeOf, payoutOf } from '@grabcode/contracts/schemas';
import { BANK, PLATFORM, SUSPENSE, coderOf, depositEntries, escrowOf, isBalanced, releaseEntries } from './ledger';

test('deposit and release always balance', () => {
  for (const amount of [1, 10_000, 2_800_000, 6_543_210]) {
    assert.ok(isBalanced(depositEntries('GC-1', amount)));
    assert.ok(isBalanced(depositEntries(null, amount)));
    assert.ok(isBalanced(releaseEntries('GC-1', amount, [20, 50, 30], 1, 'u')));
  }
  assert.ok(!isBalanced([]));
  assert.ok(!isBalanced([{ account: BANK, amountVnd: -1 }]));
});

test('deposit goes to the order escrow, unmatched to suspense', () => {
  assert.deepEqual(depositEntries('GC-7', 500).map((e) => e.account), [BANK, escrowOf('GC-7')]);
  assert.equal(depositEntries(null, 500)[1].account, SUSPENSE);
});

test('a single milestone releases the whole price: payout to the coder, rest to the platform', () => {
  assert.deepEqual(releaseEntries('GC-7', 2_800_000, [100], 0, 'k'), [
    { account: escrowOf('GC-7'), amountVnd: -2_800_000 },
    { account: coderOf('k'), amountVnd: payoutOf(2_800_000) },
    { account: PLATFORM, amountVnd: 2_800_000 - payoutOf(2_800_000) },
  ]);
});

test('milestone shares add up to exactly the price and payout, whatever the weights', () => {
  for (const weights of [[20, 50, 30], [33, 33, 33], [0, 0], [10, 10, 10, 10, 10, 10, 10], [1]]) {
    for (const price of [2_800_000, 6_543_210, 7]) {
      const all = weights.map((_, i) => releaseEntries('GC-7', price, weights, i, 'k'));
      assert.equal(all.reduce((s, e) => s - e[0].amountVnd, 0), price);
      assert.equal(all.reduce((s, e) => s + e[1].amountVnd, 0), payoutOf(price));
    }
  }
  assert.equal(milestoneShare(1000, [20, 50, 30], 1), 500);
});

test('payment code round-trips through bank transfer content', () => {
  assert.equal(paymentCodeOf('GC-1006'), 'GC1006');
  assert.equal(orderIdFromTransfer('GC1006', 'whatever'), 'GC-1006');
  assert.equal(orderIdFromTransfer(null, 'NGUYEN VAN A chuyen tien gc1006 FT123'), 'GC-1006');
  assert.equal(orderIdFromTransfer('', 'GC-42 thanh toan'), 'GC-42');
  assert.equal(orderIdFromTransfer(null, 'chuyen tien'), null);
});
