// Minimal GitHub App REST client: RS256 app JWT -> installation token -> fetch. No Octokit for ~6 calls.
import { createSign } from 'node:crypto';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** App JWT (max 10 min). iat backdated 60 s for clock drift, as GitHub recommends. */
export function appJwt(appId: string, privateKeyPem: string, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 540, iss: appId }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKeyPem);
  return `${head}.${body}.${b64url(sig)}`;
}

// 5xx, 429, secondary/primary rate limits, and 409 (repo not ready right after auto_init) are worth a retry.
export const isRetryableStatus = (status: number, rateLimitRemaining: string | null) =>
  status >= 500 || status === 429 || status === 409 || (status === 403 && rateLimitRemaining === '0');

export function createGitHubApp(cfg: { appId: string; installationId: string; privateKey: string }) {
  let cached: { token: string; expiresAt: number } | undefined;

  async function raw(method: string, path: string, auth: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${auth}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'grabcode-repo-worker',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, rateLimitRemaining: res.headers.get('x-ratelimit-remaining'), json: text ? JSON.parse(text) : null };
  }

  async function token() {
    if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
    const r = await raw('POST', `/app/installations/${cfg.installationId}/access_tokens`, appJwt(cfg.appId, cfg.privateKey));
    if (r.status !== 201) throw new GitHubError(r.status, `installation token ${r.status}: ${r.json?.message}`, isRetryableStatus(r.status, r.rateLimitRemaining));
    cached = { token: r.json.token, expiresAt: Date.parse(r.json.expires_at) };
    return cached.token;
  }

  /** Returns any response; callers decide which statuses are fine (e.g. 404 = "does not exist yet"). */
  async function gh(method: string, path: string, body?: unknown) {
    const r = await raw(method, path, await token(), body);
    if (r.status === 401) cached = undefined; // token revoked/expired early: next attempt mints a new one
    return r;
  }
  // token: git clone over HTTPS (checkout.ts).
  return Object.assign(gh, { token });
}

/** Throws GitHubError unless the status is one of `ok`. */
export function expect(r: { status: number; rateLimitRemaining: string | null; json: any }, ok: number[], what: string) {
  if (ok.includes(r.status)) return r.json;
  throw new GitHubError(r.status, `${what} ${r.status}: ${r.json?.message ?? ''}`, r.status === 401 || isRetryableStatus(r.status, r.rateLimitRemaining));
}
