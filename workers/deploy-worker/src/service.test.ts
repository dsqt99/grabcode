import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceName } from './service';

test('Cloud Run service names are valid', () => {
  assert.equal(serviceName('GC-1034'), 'gc-gc-1034');
  const long = serviceName('A'.repeat(40) + '-' + 'B'.repeat(10));
  assert.ok(long.length <= 49 && /^[a-z][a-z0-9-]*[a-z0-9]$/.test(long), long);
});
