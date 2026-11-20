'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@grabcode/auth-ui';

/**
 * P0-8: until an admin approves the coder, the app shows the application state instead of the job board and offers
 * (the API answers 403 there anyway). Mock mode (no API) has no account and passes through.
 */
export default function ApprovalGate({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  if (status !== 'authed' || !me || me.coderApproval === 'APPROVED') return <>{children}</>;
  const rejected = me.coderApproval === 'REJECTED';
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <section className="card p-6 text-center">
        <span className={`material-symbols-outlined !text-[40px] ${rejected ? 'text-red-700' : 'text-amber-text'}`} aria-hidden>
          {rejected ? 'block' : 'hourglass_top'}
        </span>
        <h1 className="mt-2 font-display text-xl font-extrabold text-ink">{rejected ? 'Hồ sơ chưa được duyệt' : 'Hồ sơ đang chờ duyệt'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {rejected
            ? 'GrabCode chưa duyệt hồ sơ freelancer của bạn nên bạn chưa nhận được việc. Liên hệ GrabCode nếu cần trao đổi thêm.'
            : 'GrabCode xem hồ sơ trước khi bạn nhận việc đã được khách thanh toán. Hoàn thiện hồ sơ (kỹ năng, portfolio, GitHub) để được duyệt nhanh hơn.'}
        </p>
        <a href="/profile" className="btn-primary mt-5 w-full">
          {rejected ? 'Xem hồ sơ' : 'Hoàn thiện hồ sơ'}
        </a>
      </section>
    </main>
  );
}
