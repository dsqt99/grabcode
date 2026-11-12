'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  AuthProviders,
  ChangePassword,
  CoderProfileDetails,
  CustomerProfile,
  Me,
  OAuthProvider,
  PasswordLogin,
  Register,
  UpdateMe,
  UserRole,
} from '@grabcode/contracts/schemas';

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type AuthStatus = 'disabled' | 'loading' | 'anon' | 'authed';
interface Ctx {
  /** 'disabled' = no API configured: POC mock mode, no login required. */
  status: AuthStatus;
  me: Me | null;
  providers: AuthProviders;
  /** `role` only matters when the OAuth login creates a new account (sign-up). */
  /** `link`: attach this provider to the signed-in account instead of signing in. */
  oauthUrl: (provider: OAuthProvider, role?: UserRole, link?: boolean) => string;
  /** All mutations reject with AuthError (status 400/401/403/409) on failure. */
  register: (input: Register) => Promise<void>;
  passwordLogin: (input: PasswordLogin) => Promise<void>;
  logout: () => Promise<void>;
  updateMe: (patch: UpdateMe) => Promise<void>;
  addRole: (role: UserRole) => Promise<void>;
  saveCoderProfile: (input: CoderProfileDetails) => Promise<void>;
  saveCustomerProfile: (input: CustomerProfile) => Promise<void>;
  changePassword: (input: ChangePassword) => Promise<void>;
}

export class AuthError extends Error {
  constructor(readonly status: number) {
    super(`auth request failed: ${status}`);
  }
}

const api = (path: string, init?: RequestInit) =>
  fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } });

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(API_URL ? 'loading' : 'disabled');
  const [me, setMe] = useState<Me | null>(null);
  const [providers, setProviders] = useState<AuthProviders>({ password: false, github: false, google: false, dev: false });

  useEffect(() => {
    if (!API_URL) return;
    Promise.all([
      api('/v1/me').then((r) => (r.ok ? (r.json() as Promise<Me>) : null)),
      api('/v1/auth/providers').then((r) => r.json() as Promise<AuthProviders>),
    ])
      .then(([m, p]) => {
        setProviders(p);
        setMe(m);
        setStatus(m ? 'authed' : 'anon');
      })
      .catch((err) => {
        console.warn('core-api unreachable, auth unavailable:', err);
        setStatus('anon');
      });
  }, []);

  const oauthUrl = useCallback((provider: OAuthProvider, role?: UserRole, link?: boolean) => {
    const back = new URL(window.location.href);
    back.searchParams.delete('auth_error');
    const q = new URLSearchParams({ redirect: back.toString() });
    if (role) q.set('role', role);
    if (link) q.set('link', '1');
    return `${API_URL}/v1/auth/${provider}?${q}`;
  }, []);

  /** Request that answers with the fresh Me (sign-in or profile update). */
  const send = async (method: string, path: string, body: unknown) => {
    const r = await api(path, { method, body: JSON.stringify(body) });
    if (!r.ok) throw new AuthError(r.status);
    setMe(await r.json());
    setStatus('authed');
  };

  const logout = async () => {
    await api('/v1/auth/logout', { method: 'POST' });
    setMe(null);
    setStatus('anon');
  };

  const changePassword = async (input: ChangePassword) => {
    const r = await api('/v1/me/password', { method: 'POST', body: JSON.stringify(input) });
    if (!r.ok) throw new AuthError(r.status);
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        me,
        providers,
        oauthUrl,
        register: (input) => send('POST', '/v1/auth/register', input),
        passwordLogin: (input) => send('POST', '/v1/auth/login', input),
        logout,
        updateMe: (patch) => send('PATCH', '/v1/me', patch),
        addRole: (role) => send('POST', '/v1/me/roles', { role }),
        saveCoderProfile: (input) => send('PUT', '/v1/me/coder-profile', input),
        saveCustomerProfile: (input) => send('PUT', '/v1/me/customer-profile', input),
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
