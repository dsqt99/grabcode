'use client';

import type { OrderMoney } from '@grabcode/contracts/schemas';
import { useCurrency } from '../lib/currency';
import { formatVnd } from '../lib/pricing';
import { BRAND } from '@grabcode/contracts';


/**
 * "Tiền của đơn" (redesign-web-order §4): where the customer's money is now, read straight from the ledger
 * (`input.money`), so it always matches the admin order detail.
 */
export default function MoneyLedger({ money, priceVnd, priceQuoted }: { money: OrderMoney; priceVnd: number; priceQuoted: boolean }) {
  const { usd } = useCurrency();
  const { paidVnd, heldVnd, releasedVnd, refundedVnd } = money;
  const pct = (v: number) => `${priceVnd > 0 ? Math.min(100, (v / priceVnd) * 100) : 0}%`;
  const rows = [
    { icon: 'account_balance', tone: 'text-stone-600', label: 'Bạn đã chuyển', value: paidVnd, show: paidVnd > 0 },
    { icon: 'shield_lock', tone: 'text-blue-700', label: `${BRAND.name} đang giữ`, value: heldVnd, show: true, strong: true },
    { icon: 'payments', tone: 'text-teal-700', label: 'Đã trả freelancer', value: releasedVnd, show: releasedVnd > 0 },
    { icon: 'undo', tone: 'text-amber-800', label: 'Đã hoàn cho bạn', value: refundedVnd, show: refundedVnd > 0 },
  ];

  return (
    <section aria-labelledby="money-title" className="card space-y-3">
      <h2 id="money-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>account_balance_wallet</span>
        Tiền của đơn
      </h2>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-600">{priceQuoted ? 'Giá chốt' : 'Giá từ · chờ báo giá'}</span>
        <span className="text-right font-display font-bold tabular-nums text-stone-900">
          {formatVnd(priceVnd)}
          {usd(priceVnd) && <span className="block text-xs font-normal text-stone-600">{usd(priceVnd)}</span>}
        </span>
      </div>

      {paidVnd > 0 ? (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-200" aria-hidden>
            <span className="bg-teal-600" style={{ width: pct(releasedVnd) }} />
            <span className="bg-blue-600" style={{ width: pct(heldVnd) }} />
            <span className="bg-amber-500" style={{ width: pct(refundedVnd) }} />
          </div>
          <dl className="divide-y divide-stone-100">
            {rows
              .filter((r) => r.show)
              .map((r) => (
                <div key={r.icon} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
                  <dt className="flex items-center gap-2 text-sm text-stone-700">
                    <span className={`material-symbols-outlined text-[20px]! ${r.tone}`} aria-hidden>{r.icon}</span>
                    {r.label}
                  </dt>
                  <dd className={`font-display tabular-nums ${r.strong ? 'font-bold text-blue-700' : 'font-semibold text-stone-900'}`}>{formatVnd(r.value)}</dd>
                </div>
              ))}
          </dl>
          <p className="help">Tiền giữ chỉ được trả cho freelancer khi bạn duyệt mốc. Mốc cuối trả khi bạn nghiệm thu.</p>
        </>
      ) : (
        <p className="text-sm text-stone-600">Chưa thanh toán</p>
      )}
    </section>
  );
}
