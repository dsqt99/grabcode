import Link from 'next/link';
import { hasSupport } from '../lib/support';
import Logo from './Logo';
import SupportContact from './SupportContact';
import { BRAND } from '@grabcode/contracts';


export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-center md:grid-cols-3 md:px-8 md:text-left">
        <div className="space-y-2">
          <Logo />
          <p className="text-balance text-sm font-semibold text-stone-900">{BRAND.tagline}</p>
          <p className="text-sm text-stone-600">Sàn kết nối chủ shop với freelancer vibe code.</p>
        </div>
        <nav aria-labelledby="footer-policy">
          <h2 id="footer-policy" className="font-display text-sm font-bold text-stone-900">Chính sách</h2>
          <ul className="mt-1">
            <li><Link href="/dieu-khoan" className="inline-flex min-h-[44px] items-center text-sm text-stone-700 hover:text-brand-800 hover:underline">Điều khoản sử dụng</Link></li>
            <li><Link href="/chinh-sach-hoan-tien" className="inline-flex min-h-[44px] items-center text-sm text-stone-700 hover:text-brand-800 hover:underline">Chính sách hoàn tiền</Link></li>
          </ul>
        </nav>
        {hasSupport && (
          <div>
            <h2 className="font-display text-sm font-bold text-stone-900">Hỗ trợ</h2>
            <SupportContact className="mt-3 justify-center text-sm md:justify-start" />
          </div>
        )}
      </div>
      <p className="border-t border-stone-200 px-4 py-4 text-center text-sm text-stone-600">© 2026 {BRAND.name} · Hoàng Hải Tech</p>
    </footer>
  );
}
