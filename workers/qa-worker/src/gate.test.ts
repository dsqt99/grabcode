import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { planSteps, scanSecrets, tail, verdict } from './gate';

const repo = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-test-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
};

test('secret scan flags keys and committed .env, ignores node_modules and .env.example', () => {
  const dir = repo({
    'src/a.ts': 'const k = "AKIAABCDEFGHIJKLMNOP";',
    '.env': 'X=1',
    '.env.example': 'X=',
    'node_modules/x/key.pem': '-----BEGIN PRIVATE KEY-----',
    'README.md': 'clean',
  });
  const c = scanSecrets(dir);
  assert.equal(c.status, 'FAILED');
  assert.equal(c.detail, ['.env: committed env file', 'src/a.ts: AWS access key'].join('\n'));
  assert.equal(scanSecrets(repo({ 'a.ts': 'ok' })).status, 'PASSED');
  rmSync(dir, { recursive: true });
});

test('plan: npm ci with lockfile, only defined scripts, placeholder test skipped', () => {
  const dir = repo({
    'package.json': JSON.stringify({ scripts: { build: 'next build', test: 'echo "Error: no test specified" && exit 1' } }),
    'package-lock.json': '{}',
  });
  const p = planSteps(dir)!;
  assert.deepEqual(p.steps.map((s) => s.name), ['install', 'build', 'audit']);
  assert.equal(p.steps[0].cmd, 'npm ci --no-audit');
  assert.deepEqual(p.skipped.map((s) => s.name), ['lint', 'typecheck', 'test']);
  assert.match(planSteps(repo({ 'package.json': '{}', 'pnpm-lock.yaml': '' }))!.steps[0].cmd, /pnpm install --frozen-lockfile/);
  assert.equal(planSteps(repo({ 'main.go': '' })), null);
});

test('verdict and tail', () => {
  assert.equal(verdict([{ name: 'a', status: 'PASSED', detail: '' }, { name: 'b', status: 'SKIPPED', detail: '' }], true), 'PASSED');
  assert.equal(verdict([{ name: 'a', status: 'FAILED', detail: '' }], true), 'FAILED');
  assert.equal(verdict([{ name: 'secrets', status: 'PASSED', detail: '' }], false), 'SKIPPED');
  assert.equal(tail('\x1b[31mred\x1b[0m'), 'red');
  assert.equal(tail('abcdef', 3), '…def');
});
