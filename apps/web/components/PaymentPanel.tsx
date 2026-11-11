'use client';

import { useEffect, useState } from 'react';
import type { PaymentInstructions } from '@grabcode/contracts/schemas';
import { devDeposit, getOrderPayment } from '../lib/api';
import { useCurrency } from '../lib/currency';

const POLL_MS = 3000;

/** Bank-transfer instructions for an unpaid (DRAFT) order. The order page's own poll picks up the status change. */
export default function PaymentPanel({ orderId }: { orderId: string }) {
  const { money } = useCurrency();
  const [p, setP] = useState<PaymentInstructions | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => getOrderPayment(orderId).then(setP, console.warn);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [orderId]);

  if (!p) return <div className="card text-sm text-slate-500">Đang tải thông tin thanh toán...</div>;

  const simulate = async () => {
    setBusy(true);
    setP(await devDeposit(orderId).catch(() => p));
    setBusy(false);
  };

  return (
    <section className="card space-y-4 border-amber-300 shadow-l3" aria-label="Thanh toán ký quỹ">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Chuyển khoản để ký quỹ</h2>
        <p className="text-sm text-slate-600">Đơn được dispatch tự động khi nhận đủ tiền. Ghi đúng nội dung chuyển khoản.</p>
      </div>
      <div className="flex flex-col gap-5 md:flex-row">
        {p.bank && p.dueVnd > 0 && (
          <img src={p.bank.qrUrl} alt={`Mã QR chuyển ${money(p.dueVnd)} nội dung ${p.content}`} width={200} height={200} className="h-[200px] w-[200px] shrink-0 rounded-xl border border-slate-200" />
        )}
        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {p.bank ? (
            <>
              <dt className="text-slate-500">Ngân hàng</dt><dd className="font-semibold">{p.bank.name}</dd>
              <dt className="text-slate-500">Số tài khoản</dt><dd className="font-mono font-semibold">{p.bank.accountNumber}</dd>
              <dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-semibold">{p.bank.accountName}</dd>
            </>
          ) : (
            <><dt className="text-slate-500">Ngân hàng</dt><dd className="text-amber-700">Chưa cấu hình tài khoản nhận (SEPAY_*)</dd></>
          )}
          <dt className="text-slate-500">Nội dung</dt><dd className="font-mono text-base font-bold text-ink">{p.content}</dd>
          <dt className="text-slate-500">Cần chuyển</dt><dd className="font-display font-extrabold text-emerald-dark">{money(p.dueVnd)}</dd>
          <dt className="text-slate-500">Đã nhận</dt><dd>{money(p.paidVnd)} / {money(p.priceVnd)}</dd>
        </dl>
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <span className="material-symbols-outlined animate-spin !text-[18px]" aria-hidden>progress_activity</span>
        {p.dueVnd > 0 ? 'Đang chờ ngân hàng xác nhận giao dịch...' : 'Đã nhận đủ, đang dispatch tìm Coder...'}
      </p>
      {p.devDeposit && p.dueVnd > 0 && (
        <button type="button" className="btn-secondary w-full" disabled={busy} onClick={simulate}>
          Giả lập đã chuyển khoản (dev)
        </button>
      )}
    </section>
  );
}
