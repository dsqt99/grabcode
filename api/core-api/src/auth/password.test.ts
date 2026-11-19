import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password';

test('scrypt hash: salted, verifies only the right password, rejects malformed', async () => {
  const [a, b] = await Promise.all([hashPassword('hunter22!'), hashPassword('hunter22!')]);
  assert.match(a, /^scrypt\$[^$]+\$[^$]+$/);
  assert.notEqual(a, b, 'random salt per hash');
  assert.equal(await verifyPassword('hunter22!', a), true);
  assert.equal(await verifyPassword('hunter22?', a), false);
  for (const bad of ['', 'plain', 'bcrypt$x$y', 'scrypt$$', a.slice(0, -4)]) assert.equal(await verifyPassword('hunter22!', bad), false, bad);
});
