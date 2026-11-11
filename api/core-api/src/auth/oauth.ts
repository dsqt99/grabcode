import type { OAuthProvider } from '@grabcode/contracts/schemas';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../config';
import type { Identity } from './auth.service';

interface Provider {
  configured: boolean;
  authorizeUrl: (redirectUri: string, state: string) => string;
  /** OAuth code -> access token -> profile. The access token is used once and never stored. */
  exchange: (code: string, redirectUri: string) => Promise<Identity>;
}

const TIMEOUT = 5000;

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} ${res.status}`);
  return res.json() as Promise<T>;
}

const github: Provider = {
  configured: !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET),
  authorizeUrl: (redirect_uri, state) =>
    `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: GITHUB_CLIENT_ID, redirect_uri, scope: 'read:user', state })}`,
  async exchange(code, redirect_uri) {
    const tok = await json<{ access_token?: string; error?: string }>(
      await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri }),
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'github token',
    );
    if (!tok.access_token) throw new Error(`github token exchange failed: ${tok.error}`);
    const u = await json<{ id: number; login: string; name: string | null; avatar_url: string | null }>(
      await fetch('https://api.github.com/user', {
        headers: { authorization: `Bearer ${tok.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'grabcode' },
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'github /user',
    );
    return { providerKey: `github:${u.id}`, githubLogin: u.login, email: null, name: u.name || u.login, avatarUrl: u.avatar_url };
  },
};

const google: Provider = {
  configured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  authorizeUrl: (redirect_uri, state) =>
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    })}`,
  async exchange(code, redirect_uri) {
    const tok = await json<{ access_token?: string }>(
      await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code, redirect_uri, grant_type: 'authorization_code' }),
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'google token',
    );
    if (!tok.access_token) throw new Error('google token exchange failed');
    // userinfo over TLS with the fresh access token: no need to verify the id_token JWT ourselves.
    const u = await json<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
      await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { authorization: `Bearer ${tok.access_token}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }),
      'google userinfo',
    );
    const email = u.email_verified ? (u.email ?? null) : null;
    return { providerKey: `google:${u.sub}`, githubLogin: null, email, name: u.name || email || 'Google user', avatarUrl: u.picture ?? null };
  },
};

export const OAUTH_PROVIDERS: Record<OAuthProvider, Provider> = { github, google };
