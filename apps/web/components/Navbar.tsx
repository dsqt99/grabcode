'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@grabcode/auth-ui';
import { BRAND } from '@grabcode/contracts';
import Logo from './Logo';


const PUBLIC_LINKS = [
  { href: '/#dispatch', label: 'Đặt đơn' },
  { href: '/#templates', label: 'Mẫu có sẵn' },
  { href: '/#compare', label: `Vì sao ${BRAND.name}` },
];
/** Separate Next app behind the same origin: plain <a>, not client-side <Link>. */
const CODER_LINK = { href: '/coder', label: 'Dành cho freelancer' };

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { status, me } = useAuth();
  const pathname = usePathname();
  // Signed in (or mock mode): "Đơn của tôi" is how a customer finds an order again (P0-6).
  const links = status === 'anon' ? PUBLIC_LINKS : [{ href: '/orders', label: 'Đơn của tôi' }, ...PUBLIC_LINKS];

  return (
    <>
      {/* Home only and not sticky: keeps the mobile header at 56px everywhere else (UX P1-14). */}
      {pathname === '/' && (
        <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-slate-100 sm:text-sm">
          <span className="material-symbols-outlined mr-1 !text-[16px] text-amber" aria-hidden>shield</span>
          Tiền giữ tại {BRAND.name}, chỉ trả cho freelancer khi bạn duyệt từng mốc <span className="mx-1 hidden sm:inline">•</span>
          <span className="hidden sm:inline">Thanh toán bằng chuyển khoản / VietQR</span>
        </div>
      )}
      <header className="sticky top-0 z-40">
        <nav aria-label="Điều hướng chính" className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:h-16 md:px-8">
            <Link href="/" className="flex min-h-[44px] shrink-0 items-center" aria-label={`${BRAND.name} – Trang chủ`}>
              <Logo />
            </Link>

            <ul className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="btn-ghost">{l.label}</Link>
                </li>
              ))}
              <li>
                <a href={CODER_LINK.href} className="btn-ghost">{CODER_LINK.label}</a>
              </li>
            </ul>

            <div className="flex items-center gap-2">
              {status === 'anon' ? (
                pathname !== '/login' && (
                  <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-secondary min-h-[44px] min-w-[44px] !px-4 !py-2 text-sm">
                    <span className="material-symbols-outlined !text-[18px]" aria-hidden>login</span> Đăng nhập
                  </Link>
                )
              ) : (
                <Link href="/profile" className="btn-ghost min-h-[44px] min-w-[44px] !p-2" aria-label={me ? `Hồ sơ của ${me.name}` : 'Hồ sơ & cài đặt'}>
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
              <Link href="/#dispatch" className="btn-primary hidden !py-2 sm:inline-flex">Đặt làm app</Link>
              <button
                type="button"
                className="btn-ghost min-h-[44px] min-w-[44px] md:hidden"
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
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 font-display font-semibold text-ink hover:bg-slate-50">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={CODER_LINK.href} className="block rounded-md px-3 py-3 font-display font-semibold text-ink hover:bg-slate-50">
                  {CODER_LINK.label}
                </a>
              </li>
              <li className="pt-2">
                <Link href="/#dispatch" onClick={() => setOpen(false)} className="btn-primary w-full">Đặt làm app</Link>
              </li>
            </ul>
          )}
        </nav>
      </header>
    </>
  );
}
