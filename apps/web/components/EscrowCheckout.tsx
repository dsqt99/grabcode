'use client';

import type { ReactNode } from 'react';
import { useCurrency } from '../lib/currency';
import { daysLabel, formatVnd } from '../lib/pricing';
import StickyActionBar from './StickyActionBar';
import { BRAND } from '@grabcode/contracts';


interface Props {
  itemName: string;
  fromPriceVnd: number;
  days: readonly [number, number];
  disabled?: boolean;
  /** Why the order cannot be created yet (shown next to the button). */
  hint?: string | null;
  submitting?: boolean;
  onConfirm: () => void;
  /** Fields the customer fills before ordering (phone, terms). */
  children?: ReactNode;
}

/** Order summary before creating the DRAFT: menu "giá từ"; the final price comes from FastDemo's quote (HON-10 Q3). */
export default function EscrowCheckout({ itemName, fromPriceVnd, days, disabled, hint, submitting, onConfirm, children }: Props) {
  // Paid in VND (bank transfer); USD is only a reference.
  const { usd } = useCurrency();

  return (
    <aside className="card min-w-0 space-y-5 shadow-l3 lg:sticky lg:top-24" aria-label="Đặt đơn">
      <h2 className="font-display text-lg font-bold text-ink">Đặt đơn & nhận báo giá</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Loại việc</dt><dd className="text-right font-semibold">{itemName}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Thời gian</dt><dd className="font-semibold">{daysLabel(days)}</dd></div>
        <div className="flex items-end justify-between border-t border-slate-100 pt-3">
          <dt className="font-display font-bold text-ink">Giá từ</dt>
          <dd className="text-right font-display text-2xl font-extrabold text-emerald-dark">
            {formatVnd(fromPriceVnd)}
            {usd(fromPriceVnd) && <span className="block text-xs font-normal text-slate-500">{usd(fromPriceVnd)}</span>}
          </dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <span className="material-symbols-outlined text-slate-500" aria-hidden>request_quote</span>
        <p>{BRAND.name} đọc yêu cầu và báo giá chốt cho đơn. Bạn chỉ chuyển khoản sau khi thấy giá chốt.</p>
      </div>

      <div className="flex gap-3 rounded-lg bg-emerald-mint p-3 text-sm text-emerald-dark">
        <span className="material-symbols-outlined" aria-hidden>shield</span>
        <p>Tiền được {BRAND.name} giữ. Freelancer nhận tiền khi bạn duyệt từng mốc; mốc cuối chỉ được trả khi bạn nghiệm thu cả đơn.</p>
      </div>

      {children}

      <StickyActionBar>
        {hint && <p className="text-center text-xs font-semibold text-amber-text lg:text-left">{hint}</p>}
        <button type="button" onClick={onConfirm} disabled={disabled || submitting} className="btn-primary w-full">
          {submitting ? 'Đang tạo đơn...' : 'Tạo đơn & chờ báo giá'}
        </button>
      </StickyActionBar>
    </aside>
  );
}
