'use client';

import { useEffect, useState } from 'react';
import type { Me } from '@grabcode/contracts/schemas';
import { BRAND } from '@grabcode/contracts';
import { ApiError, api } from '../lib/api';
import Coders from '../components/Coders';
import Orders from '../components/Orders';
import Refunds from '../components/Refunds';
import Suspense from '../components/Suspense';
import Payouts from '../components/Payouts';
import MonitorView from '../components/MonitorView';

// Ordered by money priority: orders & payments first, then what the admin still has to transfer.
const TABS = { orders: 'Đơn hàng & thanh toán', refunds: 'Chờ chuyển trả', payouts: 'Rút tiền', coders: 'Coder', suspense: 'Đối soát suspense', monitor: 'Worker / Queue' } as const;
type Tab = keyof typeof TABS;

export default function AdminPage() {
  const [me, setMe] = useState<Me | null | 'denied'>(null);
  const [tab, setTab] = useState<Tab>('orders');

  useEffect(() => {
    api<Me>('/v1/me')
      .then((m) => setMe(m.roles.includes('ADMIN') ? m : 'denied'))
      .catch((e) => {
        // Single login page lives in the web app (same origin through the /admin rewrite).
        if (e instanceof ApiError && e.status === 401) window.location.assign(`/login?next=${encodeURIComponent('/admin')}`);
        else setMe('denied');
      });
  }, []);

  if (me === null) return <p className="card mx-auto mt-16 max-w-md text-center text-stone-600" role="status">Đang kiểm tra đăng nhập…</p>;
  if (me === 'denied') return <p className="card mx-auto mt-16 max-w-md text-center font-semibold text-red-700" role="alert">Tài khoản không có quyền ADMIN (hoặc core-api không chạy).</p>;

  return (
    <>
      <header className="flex h-14 items-center justify-between bg-ink px-6 text-white">
        <h1 className="flex items-center gap-2 font-display text-base font-bold">
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden focusable="false">
            <rect width="64" height="64" rx="14" fill="#0B44CC" />
            <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="butt" strokeLinejoin="miter">
            <path d="M10 21V10h11"/><path d="M43 10h11v11"/><path d="M54 43v11H43"/><path d="M21 54H10V43"/></g>
            <g fill="#fff" transform="translate(1.5 0)"><path fillRule="evenodd" d="M17 41 23.2 23h4.6L34 41h-4.8L28 37.4h-5L21.8 41ZM24.1 33.6h2.8l-1.4-4.2Z"/><rect x="38" y="23" width="5" height="18"/></g>
            </svg>
          {BRAND.name} Admin
        </h1>
        <span className="text-sm text-stone-300">{me.email ?? me.githubLogin ?? me.name}</span>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-4 p-6">
        <nav className="flex flex-wrap gap-2" role="tablist">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`btn-compact ${tab === t ? 'btn-base bg-ink text-white' : 'btn-outline'}`}
            >
              {TABS[t]}
            </button>
          ))}
        </nav>
        {tab === 'orders' && <Orders />}
        {tab === 'refunds' && <Refunds />}
        {tab === 'payouts' && <Payouts />}
        {tab === 'coders' && <Coders />}
        {tab === 'suspense' && <Suspense />}
        {tab === 'monitor' && <MonitorView />}
      </main>
    </>
  );
}
