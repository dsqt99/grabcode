import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Throttle } from './throttle';

test('blocks after max failures inside the window, unblocks after it, reset clears', () => {
  const t = new Throttle(3, 1000);
  for (let i = 0; i < 3; i++) {
    assert.equal(t.blocked('a', 0), false);
    t.fail('a', 0);
  }
  assert.equal(t.blocked('a', 999), true);
  assert.equal(t.blocked('b', 999), false, 'keys are independent');
  assert.equal(t.blocked('a', 1000), false, 'window over');
  t.fail('a', 1000);
  assert.equal(t.blocked('a', 1000), false, 'new window starts at 1');
  t.fail('a', 1000);
  t.fail('a', 1000);
  assert.equal(t.blocked('a', 1000), true);
  t.reset('a');
  assert.equal(t.blocked('a', 1000), false);
});
