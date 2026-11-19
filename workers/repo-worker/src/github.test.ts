import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { appJwt, isRetryableStatus } from './github';

test('appJwt is an RS256 JWT GitHub accepts: iss = app id, iat backdated, exp < 10 min', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const jwt = appJwt('12345', pem, 1_000_000);
  const [h, p, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url').toString()), { iat: 999_940, exp: 1_000_540, iss: '12345' });
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s, 'base64url')));
});

test('retry only transient GitHub statuses', () => {
  for (const s of [500, 502, 429, 409]) assert.equal(isRetryableStatus(s, '10'), true, String(s));
  assert.equal(isRetryableStatus(403, '0'), true);
  for (const s of [400, 403, 404, 422]) assert.equal(isRetryableStatus(s, '10'), false, String(s));
});
