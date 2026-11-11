'use client';

import { useState } from 'react';
import { useCurrency } from '../lib/currency';

const METHODS = [
  { id: 'vietqr', label: 'VietQR', icon: 'qr_code_2' },
  { id: 'card', label: 'Thẻ quốc tế', icon: 'credit_card' },
  { id: 'bank', label: 'Chuyển khoản', icon: 'account_balance' },
] as const;

interface Props {
  tierLabel: string;
  priceVnd: number;
  etaHours: number;
  disabled?: boolean;
  submitting?: boolean;
  onConfirm: () => void;
}

export default function EscrowCheckout({ tierLabel, priceVnd, etaHours, disabled, submitting, onConfirm }: Props) {
  const { money } = useCurrency();
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('vietqr');

  return (
    <aside className="card sticky top-24 space-y-5 shadow-l3" aria-label="Ký quỹ thanh toán">
      <h2 className="font-display text-lg font-bold text-ink">Ký quỹ & Dispatch</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Gói {tierLabel}</dt><dd className="font-semibold">{money(priceVnd)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Thời gian dự kiến</dt><dd className="font-semibold">~{etaHours} giờ</dd></div>
        <div className="flex items-end justify-between border-t border-slate-100 pt-3">
          <dt className="font-display font-bold text-ink">Tổng ký quỹ</dt>
          <dd className="font-display text-2xl font-extrabold text-emerald-dark">{money(priceVnd)}</dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-lg bg-emerald-mint p-3 text-sm text-emerald-dark">
        <span className="material-symbols-outlined" aria-hidden>shield</span>
        <p><strong>Bảo hiểm 100%.</strong> Tiền được giữ an toàn, chỉ giải ngân khi bạn nghiệm thu. Không đạt thì hoàn lại toàn bộ.</p>
      </div>

      <fieldset>
        <legend className="mb-2 font-display text-sm font-semibold text-ink">Phương thức nạp ký quỹ</legend>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs font-semibold transition active:scale-95 ${
                method === m.id ? 'border-emerald bg-emerald-mint text-emerald-dark' : 'border-slate-200 text-slate-600 hover:border-emerald/40'
              }`}
            >
              <input type="radio" name="pay" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
              <span className="material-symbols-outlined" aria-hidden>{m.icon}</span>
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" onClick={onConfirm} disabled={disabled || submitting} className="btn-primary w-full">
        {submitting ? 'Đang ký quỹ...' : 'Ký quỹ bảo đảm & Dispatch tìm Coder'}
      </button>
      <p className="text-center text-xs text-slate-400">Đây là bản demo POC, không có giao dịch thật.</p>
    </aside>
  );
}
