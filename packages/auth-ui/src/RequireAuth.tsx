'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { UserRole } from '@grabcode/contracts/schemas';
import { useAuth } from './auth';
import { BrandMark } from './BrandMark';

const ROLE_COPY: Record<UserRole, { title: string; text: string; icon: string }> = {
  CUSTOMER: { title: 'Bật vai trò Khách hàng', text: 'Để đặt làm app, thanh toán và theo dõi đơn hàng.', icon: 'business_center' },
  CODER: { title: 'Bật vai trò Coder', text: 'Để nhận việc làm app và nhận tiền sau mỗi mốc được duyệt.', icon: 'code' },
};

/** Full-page navigation: the Coder PWA lives under /coder (another Next app behind the same origin). */
export const goToLogin = () => {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
};

/** Signed-in account without `role`: one click adds it (no second login). */
export function ActivateRole({ role }: { role: UserRole }) {
  const { me, addRole, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = ROLE_COPY[role];

  const activate = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await addRole(role);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <section className="card p-6 text-center">
        <BrandMark size={48} className="mx-auto mb-4" />
        <span className="material-symbols-outlined !text-[40px] text-emerald" aria-hidden>{copy.icon}</span>
        <h1 className="mt-2 font-display text-xl font-extrabold text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tài khoản {me?.email ?? me?.githubLogin ?? me?.name} chưa có vai trò này. {copy.text}
        </p>
        {failed && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            Không kích hoạt được, vui lòng thử lại.
          </p>
        )}
        <button type="button" onClick={activate} disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? 'Đang kích hoạt…' : 'Kích hoạt ngay'}
        </button>
        <button type="button" onClick={() => logout()} className="btn-ghost mt-2 w-full text-sm">
          Dùng tài khoản khác
        </button>
      </section>
    </main>
  );
}

/**
 * Children only for a signed-in user (holding `role` when given). Anonymous users go to the single
 * /login page; mock mode (no API) passes through.
 */
export function RequireAuth({ role, children }: { role?: UserRole; children: ReactNode }) {
  const { status, me } = useAuth();

  useEffect(() => {
    if (status === 'anon') goToLogin();
  }, [status]);

  if (status === 'disabled') return <>{children}</>;
  if (status !== 'authed' || !me) {
    return <p className="py-16 text-center text-sm text-slate-500" role="status">Đang kiểm tra đăng nhập…</p>;
  }
  if (role && !me.roles.includes(role)) return <ActivateRole role={role} />;
  return <>{children}</>;
}
