import Link from 'next/link';
import { hasSupport } from '../lib/support';
import SupportContact from './SupportContact';
import { BRAND } from '@grabcode/contracts';


export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
      <nav aria-label="Chính sách" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link href="/dieu-khoan" className="font-semibold text-ink hover:underline">Điều khoản sử dụng</Link>
        <Link href="/chinh-sach-hoan-tien" className="font-semibold text-ink hover:underline">Chính sách hoàn tiền</Link>
      </nav>
      {hasSupport && (
        <p className="mt-3">
          Hỗ trợ: <SupportContact />
        </p>
      )}
      <p className="mt-3">© 2026 {BRAND.name} · Hoàng Hải Tech. Sàn kết nối chủ shop với freelancer vibe code.</p>
    </footer>
  );
}
