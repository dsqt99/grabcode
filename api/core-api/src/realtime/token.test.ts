import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { connectionToken } from './token';

test('connection token is a valid HS256 JWT limited to the user channel', () => {
  const t = connectionToken('u1', 'secret', 60, 1_000_000);
  const [h, b, s] = t.split('.');
  assert.equal(s, createHmac('sha256', 'secret').update(`${h}.${b}`).digest('base64url'));
  assert.deepEqual(JSON.parse(Buffer.from(b, 'base64url').toString()), { sub: 'u1', exp: 1060, channels: ['user.u1'] });
});
