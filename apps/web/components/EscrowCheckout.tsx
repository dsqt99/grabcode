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

/** Order summary before creating the DRAFT: menu "giá từ"; the final price comes from Ai Code AI's quote (HON-10 Q3). */
export default function EscrowCheckout({ itemName, fromPriceVnd, days, disabled, hint, submitting, onConfirm, children }: Props) {
  // Paid in VND (bank transfer); USD is only a reference.
  const { usd } = useCurrency();

  return (
    <aside className="card-raised min-w-0 space-y-4 lg:sticky lg:top-24" aria-label="Đặt đơn">
      <h2 className="font-display text-lg font-bold text-stone-900 md:text-xl">Đặt đơn & nhận báo giá</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-stone-600">Loại việc</dt><dd className="text-right font-semibold">{itemName}</dd></div>
        <div className="flex justify-between"><dt className="text-stone-600">Thời gian</dt><dd className="font-semibold">{daysLabel(days)}</dd></div>
        <div className="flex items-end justify-between border-t border-stone-200 pt-3">
          <dt className="font-display font-bold text-stone-900">Giá từ</dt>
          <dd className="text-right font-display text-[28px] font-extrabold tabular-nums text-brand-800">
            {formatVnd(fromPriceVnd)}
            {usd(fromPriceVnd) && <span className="block text-xs font-normal text-stone-600">{usd(fromPriceVnd)}</span>}
          </dd>
        </div>
      </dl>

      <div className="banner-info">
        <span className="material-symbols-outlined text-blue-700" aria-hidden>request_quote</span>
        <p>{BRAND.name} đọc yêu cầu và báo giá chốt cho đơn. Bạn chỉ chuyển khoản sau khi thấy giá chốt.</p>
      </div>

      <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>shield_lock</span>
        <p>Tiền được {BRAND.name} giữ. Freelancer nhận tiền khi bạn duyệt từng mốc; mốc cuối chỉ được trả khi bạn nghiệm thu cả đơn.</p>
      </div>

      {children}

      <StickyActionBar>
        {hint && <p className="text-center text-sm font-semibold text-amber-800 lg:text-left">{hint}</p>}
        <button type="button" onClick={onConfirm} disabled={disabled || submitting} className="btn-primary w-full">
          {submitting ? (
            <>
              <span className="material-symbols-outlined spinner" aria-hidden>progress_activity</span>
              Đang tạo đơn…
            </>
          ) : (
            'Tạo đơn & chờ báo giá'
          )}
        </button>
        <p className="text-center text-xs text-stone-600 lg:text-left">Chưa thu tiền ở bước này.</p>
      </StickyActionBar>
    </aside>
  );
}
