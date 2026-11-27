'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@grabcode/auth-ui';
import { BRAND } from '@grabcode/contracts';

/**
 * P0-8: until an admin approves the coder, the app shows the application state instead of the job board and offers
 * (the API answers 403 there anyway). Mock mode (no API) has no account and passes through.
 */
export default function ApprovalGate({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  if (status !== 'authed' || !me || me.coderApproval === 'APPROVED') return <>{children}</>;
  const rejected = me.coderApproval === 'REJECTED';
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <section className="card text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${rejected ? 'bg-red-50 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
          <span className="material-symbols-outlined text-[40px]!" aria-hidden>{rejected ? 'block' : 'hourglass_top'}</span>
        </span>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-900">{rejected ? 'Hồ sơ chưa được duyệt' : 'Hồ sơ đang chờ duyệt'}</h1>
        <p className="mt-2 text-sm text-stone-600">
          {rejected
            ? `${BRAND.name} chưa duyệt hồ sơ freelancer của bạn nên bạn chưa nhận được việc. Liên hệ ${BRAND.name} nếu cần trao đổi thêm.`
            : `${BRAND.name} xem hồ sơ trước khi bạn nhận việc đã được khách thanh toán. Hoàn thiện hồ sơ (kỹ năng, portfolio, GitHub) để được duyệt nhanh hơn.`}
        </p>
        {!rejected && (
          <ol className="mt-4 space-y-2 text-left text-sm text-stone-700">
            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-teal-700" aria-hidden>check_circle</span> Đã tạo tài khoản freelancer</li>
            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-800" aria-hidden>edit_note</span> Hoàn thiện hồ sơ: kỹ năng, portfolio, GitHub</li>
            <li className="flex items-center gap-2"><span className="material-symbols-outlined text-stone-600" aria-hidden>hourglass_top</span> {BRAND.name} duyệt rồi bạn thấy bảng việc</li>
          </ol>
        )}
        <a href="/profile" className="btn-primary mt-5 w-full">
          {rejected ? 'Xem hồ sơ' : 'Hoàn thiện hồ sơ'}
        </a>
      </section>
    </main>
  );
}
