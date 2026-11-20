'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { UserRole } from '@grabcode/contracts/schemas';
import { LoginBanner, LoginPanel, RolePicker } from '../../components/AuthGate';
import { useAuth } from '@grabcode/auth-ui';

/** Only same-origin paths, so ?next= cannot bounce the user to another site ("/\\evil.com", "/\t/evil.com" parse as external). */
const safeNext = (next: string | null) => {
  if (!next?.startsWith('/') || typeof window === 'undefined') return null;
  try {
    const u = new URL(next, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
};

function Login() {
  const { status, me, addRole } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const defaultRole: UserRole = next?.startsWith('/coder') ? 'CODER' : 'CUSTOMER';
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [busy, setBusy] = useState(false);
  const needsRole = status === 'authed' && me?.roles.length === 0;

  useEffect(() => {
    if (status === 'disabled') return router.replace(next ?? '/');
    if (status !== 'authed' || !me || me.roles.length === 0) return;
    const target = next ?? (me.roles.includes('CUSTOMER') ? '/' : '/coder');
    // /coder is a separate Next app behind the same origin: needs a full page load.
    if (target.startsWith('/coder')) window.location.replace(target);
    else router.replace(target);
  }, [status, me, next, router]);

  if (status === 'anon') {
    return (
      <LoginBanner>
        <LoginPanel defaultRole={defaultRole} />
      </LoginBanner>
    );
  }
  if (needsRole) {
    // New OAuth account created from the login tab: pick the role once.
    return (
      <LoginBanner>
        <section className="card w-full p-6 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Chào {me?.name}, bạn dùng GrabCode để làm gì?</h1>
          <div className="mt-5">
            <RolePicker value={role} onChange={setRole} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              addRole(role).finally(() => setBusy(false));
            }}
            className="btn-primary mt-5 w-full"
          >
            {busy ? 'Đang lưu…' : 'Tiếp tục'}
          </button>
        </section>
      </LoginBanner>
    );
  }
  return <p className="py-16 text-center text-sm text-slate-500" role="status">Đang chuyển trang…</p>;
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
