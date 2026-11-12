// QA Gate plan and verdict. Pure (fs reads only) so it is unit-tested without Docker.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { QaCheck, QaResult } from '@grabcode/contracts';

export type Check = QaCheck;
export type Status = QaResult['status'];
/** A step run inside the sandbox container (sh -c). */
export type Step = { name: string; cmd: string };

const SECRET_PATTERNS: [string, RegExp][] = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{32,}\b/],
];
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

/** Committed secrets (and committed .env files). Runs on the checkout before anything is installed. */
export function scanSecrets(dir: string): Check {
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p);
        continue;
      }
      const rel = relative(dir, p).replaceAll('\\', '/');
      if (/^\.env(\..+)?$/.test(e.name) && !/\.(example|sample|template)$/.test(e.name)) hits.push(`${rel}: committed env file`);
      if (statSync(p).size > 1_000_000) continue;
      const text = readFileSync(p, 'utf8');
      for (const [what, re] of SECRET_PATTERNS) if (re.test(text)) hits.push(`${rel}: ${what}`);
    }
  };
  walk(dir);
  return hits.length
    ? { name: 'secrets', status: 'FAILED', detail: hits.slice(0, 20).join('\n') }
    : { name: 'secrets', status: 'PASSED', detail: 'no committed secrets found' };
}

/**
 * Steps for a Node project: install, then lint / typecheck / build / test when the package defines them,
 * then a dependency audit (high+ in prod deps). null = not a Node project (gate SKIPPED).
 */
export function planSteps(dir: string): { steps: Step[]; skipped: Check[] } | null {
  if (!existsSync(join(dir, 'package.json'))) return null;
  const scripts: Record<string, string> = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {};
  const pnpm = existsSync(join(dir, 'pnpm-lock.yaml'));
  const pm = pnpm ? 'corepack enable pnpm && pnpm' : 'npm';
  const steps: Step[] = [
    {
      name: 'install',
      cmd: pnpm ? `${pm} install --frozen-lockfile` : existsSync(join(dir, 'package-lock.json')) ? 'npm ci --no-audit' : 'npm install --no-audit',
    },
  ];
  const skipped: Check[] = [];
  for (const s of ['lint', 'typecheck', 'build', 'test']) {
    // npm init's placeholder test script always exits 1.
    if (scripts[s] && !scripts[s].includes('no test specified')) steps.push({ name: s, cmd: `${pm} run ${s}` });
    else skipped.push({ name: s, status: 'SKIPPED', detail: `no "${s}" script in package.json` });
  }
  steps.push({ name: 'audit', cmd: pnpm ? `${pm} audit --prod --audit-level high` : 'npm audit --omit=dev --audit-level=high' });
  return { steps, skipped };
}

/** FAILED if any check failed; SKIPPED when nothing but the secret scan ran. */
export function verdict(checks: Check[], nodeProject: boolean): Status {
  if (checks.some((c) => c.status === 'FAILED')) return 'FAILED';
  return nodeProject ? 'PASSED' : 'SKIPPED';
}

/** Last `max` chars without ANSI colors: enough to see why a step failed, small enough for the order row. */
export const tail = (out: string, max = 1500) => {
  const s = out.replace(/\x1b\[[0-9;]*m/g, '').trim();
  return s.length > max ? '…' + s.slice(-max) : s;
};
