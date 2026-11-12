'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

const LINKS = [
  { href: '/#dispatch', label: 'Đặt đơn' },
  { href: '/#templates', label: 'Template' },
  { href: '/#compare', label: 'Vì sao GrabCode' },
  { href: '/coder', label: 'Dành cho Coder' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { status, me } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-slate-100 sm:text-sm">
        <span className="material-symbols-outlined mr-1 !text-[16px] text-amber" aria-hidden>bolt</span>
        Cam kết giao link demo chạy thật trong 2–8 giờ <span className="mx-1 hidden sm:inline">•</span>
        <span className="hidden sm:inline">Đã có 500+ Coder sẵn sàng</span>
      </div>
      <nav aria-label="Điều hướng chính" className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="flex shrink-0 items-center">
            <img src="/logo.png" alt="GrabCode" width={240} height={47} className="h-8 w-auto md:h-9" />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                {l.href === '/coder' ? <a href={l.href} className="btn-ghost">{l.label}</a> : <Link href={l.href} className="btn-ghost">{l.label}</Link>}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {status === 'anon' ? (
              pathname !== '/login' && (
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-secondary !px-4 !py-2 text-sm">
                  <span className="material-symbols-outlined !text-[18px]" aria-hidden>login</span> Đăng nhập
                </Link>
              )
            ) : (
              <Link href="/profile" className="btn-ghost !p-2" aria-label={me ? `Hồ sơ của ${me.name}` : 'Hồ sơ & cài đặt'}>
                {me?.avatarUrl ? (
                  <img src={me.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : me ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald font-display text-sm font-bold uppercase text-white" aria-hidden>
                    {me.name.charAt(0)}
                  </span>
                ) : (
                  <span className="material-symbols-outlined" aria-hidden>account_circle</span>
                )}
              </Link>
            )}
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
