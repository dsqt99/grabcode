'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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

const MENU_ID = 'main-menu';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { status, me } = useAuth();
  const pathname = usePathname();
  // Signed in (or mock mode): "Đơn của tôi" is how a customer finds an order again (P0-6).
  const links = status === 'anon' ? PUBLIC_LINKS : [{ href: '/orders', label: 'Đơn của tôi' }, ...PUBLIC_LINKS];

  // The mobile menu closes on navigation and on Esc (redesign-web-home §0).
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Home only and not sticky: keeps the mobile header at 56px everywhere else (UX P1-14). */}
      {pathname === '/' && (
        <div className="bg-ink px-4 py-2 text-center text-sm font-medium text-white">
          <span className="material-symbols-outlined mr-1 !text-[18px] text-brand-300" aria-hidden>shield_lock</span>
          Tiền giữ tại {BRAND.name}, chỉ trả cho freelancer khi bạn duyệt từng mốc
          <span className="hidden md:inline"> · Thanh toán bằng chuyển khoản / VietQR</span>
        </div>
      )}
      <header className="sticky top-0 z-40">
        <nav aria-label="Điều hướng chính" className="border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 md:h-16 md:px-8">
            <Link href="/" className="flex min-h-[44px] shrink-0 items-center" aria-label={`${BRAND.name} – Trang chủ`}>
              <Logo />
            </Link>

            <ul className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={pathname === l.href ? 'page' : undefined}
                    className={`btn-ghost btn-sm ${pathname === l.href ? 'bg-brand-50 text-brand-800' : ''}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={CODER_LINK.href} className="btn-ghost btn-sm">{CODER_LINK.label}</a>
              </li>
            </ul>

            <div className="flex items-center gap-1">
              {status === 'anon' ? (
                pathname !== '/login' && (
                  <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-secondary btn-sm">
                    Đăng nhập
                  </Link>
                )
              ) : (
                <>
                  {/* Mobile: one tap to "Đơn của tôi" from any page (Màn D AC1: reopen an order in ≤2 taps from home). */}
                  {pathname !== '/orders' && (
                    <Link href="/orders" className="btn-icon lg:hidden" aria-label="Đơn của tôi">
                      <span className="material-symbols-outlined" aria-hidden>receipt_long</span>
                    </Link>
                  )}
                  <Link href="/profile" className="btn-icon" aria-label={me ? `Hồ sơ của ${me.name}` : 'Hồ sơ & cài đặt'}>
                    {me?.avatarUrl ? (
                      <img src={me.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : me ? (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 font-display text-sm font-bold uppercase text-white" aria-hidden>
                        {me.name.charAt(0)}
                      </span>
                    ) : (
                      <span className="material-symbols-outlined" aria-hidden>account_circle</span>
                    )}
                  </Link>
                </>
              )}
              <Link href="/#dispatch" className="btn-primary btn-sm ml-1 hidden lg:inline-flex">Đặt POC demo</Link>
              <button
                type="button"
                className="btn-icon lg:hidden"
                aria-expanded={open}
                aria-controls={MENU_ID}
                aria-label={open ? 'Đóng menu' : 'Mở menu'}
                onClick={() => setOpen((v) => !v)}
              >
                <span className="material-symbols-outlined" aria-hidden>{open ? 'close' : 'menu'}</span>
              </button>
            </div>
          </div>
          {open && (
            <ul id={MENU_ID} className="border-t border-stone-200 bg-white px-4 pb-4 pt-2 lg:hidden">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center rounded-xl px-3 font-display font-semibold text-stone-900 hover:bg-stone-50">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={CODER_LINK.href} className="flex min-h-[48px] items-center rounded-xl px-3 font-display font-semibold text-stone-900 hover:bg-stone-50">
                  {CODER_LINK.label}
                </a>
              </li>
              <li className="pt-2">
                <Link href="/#dispatch" onClick={() => setOpen(false)} className="btn-primary w-full">Đặt POC demo</Link>
              </li>
            </ul>
          )}
        </nav>
      </header>
    </>
  );
}
