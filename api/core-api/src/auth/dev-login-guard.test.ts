import assert from 'node:assert/strict';
import test from 'node:test';

// Dev-login is the way to become ADMIN without SQL: it must stay off in production and key-protected on staging.
async function devLogin(env: Record<string, string | undefined>) {
  const keys = ['NODE_ENV', 'APP_ENV', 'AUTH_DEV_LOGIN', 'STAGING_DEV_LOGIN_KEY'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try {
    const cfg = await import(`../config.ts?${Math.random()}`);
    return { enabled: cfg.DEV_LOGIN_ENABLED as boolean, key: cfg.DEV_LOGIN_KEY as string };
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('production ignores AUTH_DEV_LOGIN, with or without a key', async () => {
  assert.equal((await devLogin({ NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true' })).enabled, false);
  assert.equal((await devLogin({ NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: 'x'.repeat(32) })).enabled, false);
  assert.equal((await devLogin({ NODE_ENV: 'production', APP_ENV: 'production', AUTH_DEV_LOGIN: 'true' })).enabled, false);
});

test('staging needs APP_ENV=staging, AUTH_DEV_LOGIN=true and a key of 16+ characters', async () => {
  const key = 'k'.repeat(24);
  const on = await devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: key });
  assert.deepEqual(on, { enabled: true, key });
  assert.equal((await devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true' })).enabled, false, 'no key: off');
  assert.equal((await devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', AUTH_DEV_LOGIN: 'true', STAGING_DEV_LOGIN_KEY: 'short' })).enabled, false);
  assert.equal((await devLogin({ NODE_ENV: 'production', APP_ENV: 'staging', STAGING_DEV_LOGIN_KEY: key })).enabled, false, 'flag off');
});

test('local development keeps working without a key', async () => {
  assert.deepEqual(await devLogin({ AUTH_DEV_LOGIN: 'true' }), { enabled: true, key: '' });
  assert.equal((await devLogin({})).enabled, false);
});
