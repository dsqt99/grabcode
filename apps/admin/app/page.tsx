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
            <rect width="64" height="64" rx="16" fill="#EA580C" />
            <path d="M26 24c0-4 2.6-7 6-7s6 3 6 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <path d="M21 25h22a2 2 0 0 1 2 2.1l-1.4 19a3 3 0 0 1-3 2.8H23.4a3 3 0 0 1-3-2.8L19 27.1A2 2 0 0 1 21 25Z" fill="#fff" />
            <path d="M29 31v10l8.5-5Z" fill="#EA580C" />
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
