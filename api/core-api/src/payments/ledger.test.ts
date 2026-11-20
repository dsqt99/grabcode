import assert from 'node:assert/strict';
import { test } from 'node:test';
import { milestoneShare, orderIdFromTransfer, paymentCodeOf, payoutOf } from '@grabcode/contracts/schemas';
import { BANK, PLATFORM, SUSPENSE, coderOf, depositEntries, escrowOf, isBalanced, moveEntries, payoutEntries, releaseEntries, resolveEntries } from './ledger';

test('deposit and release always balance', () => {
  for (const amount of [1, 10_000, 2_800_000, 6_543_210]) {
    assert.ok(isBalanced(depositEntries('GC-1', amount)));
    assert.ok(isBalanced(depositEntries(null, amount)));
    assert.ok(isBalanced(releaseEntries('GC-1', amount, payoutOf(amount), [20, 50, 30], 1, 'u')));
  }
  assert.ok(!isBalanced([]));
  assert.ok(!isBalanced([{ account: BANK, amountVnd: -1 }]));
});

test('deposit goes to the order escrow, unmatched to suspense', () => {
  assert.deepEqual(depositEntries('GC-7', 500).map((e) => e.account), [BANK, escrowOf('GC-7')]);
  assert.equal(depositEntries(null, 500)[1].account, SUSPENSE);
});

test('a single milestone releases the whole price: payout to the coder, rest to the platform', () => {
  assert.deepEqual(releaseEntries('GC-7', 2_800_000, payoutOf(2_800_000), [100], 0, 'k'), [
    { account: escrowOf('GC-7'), amountVnd: -2_800_000 },
    { account: coderOf('k'), amountVnd: payoutOf(2_800_000) },
    { account: PLATFORM, amountVnd: 2_800_000 - payoutOf(2_800_000) },
  ]);
});

test('milestone shares add up to exactly the price and payout, whatever the weights', () => {
  for (const weights of [[20, 50, 30], [33, 33, 33], [0, 0], [10, 10, 10, 10, 10, 10, 10], [1]]) {
    for (const price of [2_800_000, 6_543_210, 7]) {
      const all = weights.map((_, i) => releaseEntries('GC-7', price, payoutOf(price), weights, i, 'k'));
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

test('dispute split: refund + coder share + platform fee always equal the escrow', () => {
  for (const [escrow, refund] of [[2_800_000, 0], [2_800_000, 2_800_000], [2_800_000, 1_000_000], [900, 0], [1_234_567, 7]]) {
    const e = resolveEntries('GC-7', escrow, refund, 'k', escrow, payoutOf(escrow));
    assert.ok(isBalanced(e), `${escrow}/${refund}`);
    assert.equal(e[0].amountVnd, -escrow);
    assert.equal(e.find((x) => x.account === BANK)?.amountVnd ?? 0, refund);
    assert.ok(e.every((x) => x.account === escrowOf('GC-7') || x.amountVnd > 0), 'only escrow is debited');
  }
  // full refund: nothing for the coder or the platform
  assert.deepEqual(resolveEntries('GC-7', 500_000, 500_000, 'k', 500_000, payoutOf(500_000)).map((x) => x.account), [escrowOf('GC-7'), BANK]);
  // no refund: same split as releasing the whole price
  assert.equal(resolveEntries('GC-7', 2_800_000, 0, 'k', 2_800_000, payoutOf(2_800_000)).find((x) => x.account === coderOf('k'))?.amountVnd, payoutOf(2_800_000));
});

test('refunds, payouts and suspense moves balance and debit the source', () => {
  assert.deepEqual(payoutEntries(coderOf('k'), 300_000), [{ account: coderOf('k'), amountVnd: -300_000 }, { account: BANK, amountVnd: 300_000 }]);
  assert.deepEqual(moveEntries(SUSPENSE, escrowOf('GC-7'), 50), [{ account: SUSPENSE, amountVnd: -50 }, { account: escrowOf('GC-7'), amountVnd: 50 }]);
  assert.ok(isBalanced(payoutEntries(escrowOf('GC-7'), 1)));
});

test('payout is the order snapshot, not the current rate', () => {
  // An order created at 80% keeps paying 80% even though CODER_PAYOUT_RATE changed since.
  const e = releaseEntries('GC-7', 1_000_000, 800_000, [100], 0, 'k');
  assert.equal(e[1].amountVnd, 800_000);
  assert.equal(e[2].amountVnd, 200_000);
  const r = resolveEntries('GC-7', 1_000_000, 500_000, 'k', 1_000_000, 800_000);
  assert.equal(r.find((x) => x.account === coderOf('k'))?.amountVnd, 400_000);
  assert.ok(isBalanced(r));
});
