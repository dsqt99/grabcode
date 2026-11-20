'use client';

import type { ReactNode } from 'react';
import { useCurrency } from '../lib/currency';
import { formatVnd } from '../lib/pricing';
import StickyActionBar from './StickyActionBar';

interface Props {
  tierLabel: string;
  priceVnd: number;
  etaHours: number;
  disabled?: boolean;
  /** Why the order cannot be created yet (shown next to the button). */
  hint?: string | null;
  submitting?: boolean;
  onConfirm: () => void;
  /** Fields the customer fills before ordering (phone, terms). */
  children?: ReactNode;
}

export default function EscrowCheckout({ tierLabel, priceVnd, etaHours, disabled, hint, submitting, onConfirm, children }: Props) {
  // Escrow is paid in VND (bank transfer); USD is only a reference.
  const { usd } = useCurrency();

  return (
    <aside className="card min-w-0 space-y-5 shadow-l3 lg:sticky lg:top-24" aria-label="Ký quỹ thanh toán">
      <h2 className="font-display text-lg font-bold text-ink">Ký quỹ & đặt đơn</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Gói {tierLabel}</dt><dd className="font-semibold">{formatVnd(priceVnd)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Thời gian dự kiến</dt><dd className="font-semibold">~{etaHours} giờ</dd></div>
        <div className="flex items-end justify-between border-t border-slate-100 pt-3">
          <dt className="font-display font-bold text-ink">Tổng ký quỹ</dt>
          <dd className="text-right font-display text-2xl font-extrabold text-emerald-dark">
            {formatVnd(priceVnd)}
            {usd(priceVnd) && <span className="block text-xs font-normal text-slate-500">{usd(priceVnd)}</span>}
          </dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-lg bg-emerald-mint p-3 text-sm text-emerald-dark">
        <span className="material-symbols-outlined" aria-hidden>shield</span>
        <p>Tiền giữ ký quỹ trên GrabCode, chỉ giải ngân cho freelancer khi bạn duyệt từng mốc.</p>
      </div>

      <p className="flex items-center gap-2 text-sm text-slate-600">
        <span className="material-symbols-outlined text-slate-400" aria-hidden>qr_code_2</span>
        Thanh toán: chuyển khoản ngân hàng / quét VietQR ở bước sau
      </p>

      {children}

      <StickyActionBar>
        {hint && <p className="text-center text-xs font-semibold text-amber-text lg:text-left">{hint}</p>}
        <button type="button" onClick={onConfirm} disabled={disabled || submitting} className="btn-primary w-full">
          {submitting ? 'Đang tạo đơn...' : 'Tạo đơn & chuyển sang thanh toán'}
        </button>
      </StickyActionBar>
    </aside>
  );
}
