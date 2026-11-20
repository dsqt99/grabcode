'use client';

import { useEffect, useState } from 'react';
import { RefundAccountSchema, type RefundAccount } from '@grabcode/contracts/schemas';
import { getRefundAccount, putRefundAccount } from '../lib/api';
import { formatVnd } from '../lib/pricing';
import { BRAND } from '@grabcode/contracts';


const EMPTY: RefundAccount = { bankName: '', accountNumber: '', accountName: '' };

/**
 * Where FastDemo transfers a refund of this order (cancelled, auto refund, dispute split). Admins see it on the refund.
 * `dueVnd` set: a refund is due now, the form opens right away (redesign-web-order §6); otherwise a collapsed row.
 */
export default function RefundAccountCard({ orderId, dueVnd }: { orderId: string; dueVnd?: number }) {
  const urgent = dueVnd !== undefined;
  const [saved, setSaved] = useState<RefundAccount | null | undefined>(undefined);
  const [form, setForm] = useState<RefundAccount>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRefundAccount(orderId).then(
      (a) => {
        setSaved(a);
        setEditing(!a && urgent);
        if (a) setForm(a);
      },
      () => setError('Không tải được tài khoản nhận hoàn.'),
    );
  }, [orderId, urgent]);

  const save = async () => {
    const parsed = RefundAccountSchema.safeParse({ ...form, accountName: form.accountName.toUpperCase() });
    if (!parsed.success) return setError('Kiểm tra lại: tên ngân hàng, số tài khoản (chỉ chữ số) và tên chủ tài khoản.');
    setBusy(true);
    setError(null);
    try {
      const a = await putRefundAccount(orderId, parsed.data);
      setSaved(a);
      setForm(a);
      setEditing(false);
      setDone(true);
    } catch {
      setError('Chưa lưu được, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof RefundAccount, label: string, extra: object = {}) => (
    <div>
      <label htmlFor={`refund-${key}`} className="label">{label}</label>
      <input id={`refund-${key}`} className="field" value={form[key]} disabled={busy} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <section className={`${urgent ? 'card-action' : 'card'} space-y-3`} aria-labelledby="refund-account-title">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="refund-account-title" className="font-display text-base font-bold text-stone-900">Tài khoản nhận hoàn tiền</h2>
          {saved === undefined && !error ? (
            <div className="skeleton mt-1 h-4 w-32" aria-busy="true"><span className="sr-only">Đang tải…</span></div>
          ) : (
            !editing && (
              <p className="text-sm text-stone-600">
                {saved ? `${saved.bankName} · ****${saved.accountNumber.slice(-4)}` : 'Chưa khai báo'}
              </p>
            )
          )}
        </div>
        {saved !== undefined && !editing && (
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => (setEditing(true), setDone(false))}>
            {saved ? 'Sửa' : 'Thêm'}
          </button>
        )}
      </div>
      {urgent && (
        <p className="banner-warn">
          <span className="material-symbols-outlined !text-[20px]" aria-hidden>undo</span>
          {BRAND.name} cần tài khoản này để chuyển trả {formatVnd(dueVnd)}.
        </p>
      )}
      {editing && (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">Nếu đơn bị huỷ hoặc được hoàn một phần, {BRAND.name} chuyển trả vào tài khoản này.</p>
          {field('bankName', 'Ngân hàng', { placeholder: 'VD: MB Bank', autoComplete: 'off' })}
          {field('accountNumber', 'Số tài khoản', { inputMode: 'numeric', placeholder: 'Chỉ chữ số', autoComplete: 'off' })}
          {field('accountName', 'Chủ tài khoản', { placeholder: 'VD: NGUYEN VAN A', autoCapitalize: 'characters', autoComplete: 'off' })}
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
            {busy ? 'Đang lưu…' : 'Lưu tài khoản nhận hoàn'}
          </button>
          {(saved || !urgent) && (
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => (setEditing(false), setError(null), setForm(saved ?? EMPTY))}>
              Huỷ
            </button>
          )}
        </div>
      )}
      {done && !editing && <p className="text-sm text-teal-700" role="status">Đã lưu</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
}
