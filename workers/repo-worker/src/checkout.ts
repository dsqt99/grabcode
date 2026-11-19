// Shared by qa-worker / deploy-worker: fetch one commit of an order repo into a temp dir, without git credentials left behind.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createGitHubApp, GitHubError } from './github';

const run = promisify(execFile);

/** GitHub App from the same env as repo-worker; null when not configured. */
export function githubAppFromEnv() {
  const appId = process.env.GITHUB_APP_ID ?? '';
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID ?? '';
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY_PATH
    ? readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8')
    : (process.env.GITHUB_APP_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  return appId && installationId && privateKey ? createGitHubApp({ appId, installationId, privateKey }) : null;
}

/**
 * Clones `repoFullName` and checks out `sha` (null = default branch). `.git` is deleted afterwards, so the
 * installation token in the remote URL never reaches the untrusted build that runs on the directory.
 * GIT_CLONE_BASE (e.g. file:///D:/repos) clones `${base}/${repoFullName}.git` instead of GitHub: local tests only.
 * Caller removes the returned dir.
 */
export async function checkout(gh: ReturnType<typeof createGitHubApp> | null, repoFullName: string, sha: string | null) {
  const base = process.env.GIT_CLONE_BASE;
  if (!base && !gh) throw new GitHubError(0, 'GitHub App not configured (GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / private key)', false);
  const url = base ? `${base}/${repoFullName}.git` : `https://x-access-token:${await gh!.token()}@github.com/${repoFullName}.git`;
  const dir = await mkdtemp(join(tmpdir(), 'gc-checkout-'));
  try {
    await run('git', ['clone', '--quiet', '--no-tags', url, dir], { timeout: 300_000 });
    if (sha) await run('git', ['-C', dir, 'checkout', '--quiet', '--detach', sha], { timeout: 60_000 });
    await rm(join(dir, '.git'), { recursive: true, force: true });
    return dir;
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    // The token must not leak into logs / failure events through git's error message.
    throw new Error(String(err instanceof Error ? err.message : err).replace(/x-access-token:[^@]+@/g, 'x-access-token:***@'));
  }
}
