import assert from 'node:assert/strict';
import test from 'node:test';
import { devLoginState } from '../config';

// Dev-login is the way to become ADMIN without SQL: it must stay off in production and key-protected on staging.
const devLogin = (env: Record<string, string | undefined>) => devLoginState(env);

test('production ignores AUTH_DEV_LOGIN, with or without a key', () => {
  assert.equal(devLogin({ NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true' }).enabled, false);
  assert.equal(devLogin({ NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: 'x'.repeat(32) }).enabled, false);
  assert.equal(devLogin({ NODE_ENV: 'production', APP_ENV: 'production', AUTH_DEV_LOGIN: 'true' }).enabled, false);
});

test('staging needs APP_ENV=staging, AUTH_DEV_LOGIN=true and a key of 16+ characters', () => {
  const key = 'k'.repeat(24);
  const on = devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: key });
  assert.deepEqual(on, { enabled: true, key });
  assert.equal(devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true' }).enabled, false, 'no key: off');
  assert.equal(devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: 'short' }).enabled, false);
  assert.equal(devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', STAGING_DEV_LOGIN_KEY: key }).enabled, false, 'flag off');
});

test('local development keeps working without a key', () => {
  assert.deepEqual(devLogin({ AUTH_DEV_LOGIN: 'true' }), { enabled: true, key: '' });
  assert.equal(devLogin({}).enabled, false);
});
