'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCurrency } from '../lib/currency';

const LINKS = [
  { href: '/#dispatch', label: 'Đặt đơn' },
  { href: '/#templates', label: 'Template' },
  { href: '/#compare', label: 'Vì sao GrabCode' },
  { href: '/coder', label: 'Dành cho Coder' },
];

export default function Navbar() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-slate-100 sm:text-sm">
        <span className="material-symbols-outlined mr-1 !text-[16px] text-amber" aria-hidden>bolt</span>
        Cam kết giao link demo chạy thật trong 2–8 giờ <span className="mx-1 hidden sm:inline">•</span>
        <span className="hidden sm:inline">Đã có 500+ Coder sẵn sàng</span>
      </div>
      <nav aria-label="Điều hướng chính" className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald text-white">
              <span className="material-symbols-outlined !text-[20px]" aria-hidden>terminal</span>
            </span>
            Grab<span className="text-emerald">Code</span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                {l.href === '/coder' ? <a href={l.href} className="btn-ghost">{l.label}</a> : <Link href={l.href} className="btn-ghost">{l.label}</Link>}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <div role="group" aria-label="Đơn vị tiền tệ" className="flex rounded-full bg-slate-100 p-1">
              {(['VND', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => setCurrency(c)}
                  className={`rounded-full px-3 py-1 font-display text-xs font-bold transition ${
                    currency === c ? 'bg-white text-emerald-dark shadow-l2' : 'text-slate-500 hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <Link href="/#dispatch" className="btn-primary hidden !py-2 sm:inline-flex">Đặt POC ngay</Link>
            <button
              type="button"
              className="btn-ghost md:hidden"
              aria-expanded={open}
              aria-label="Mở menu"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="material-symbols-outlined" aria-hidden>{open ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
        {open && (
          <ul className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 font-display font-semibold text-ink hover:bg-slate-50">
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link href="/#dispatch" onClick={() => setOpen(false)} className="btn-primary w-full">Đặt POC ngay</Link>
            </li>
          </ul>
        )}
      </nav>
    </header>
  );
}
