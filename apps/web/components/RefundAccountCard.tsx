'use client';

import { useEffect, useState } from 'react';
import { RefundAccountSchema, type RefundAccount } from '@grabcode/contracts/schemas';
import { getRefundAccount, putRefundAccount } from '../lib/api';
import { BRAND } from '@grabcode/contracts';


const EMPTY: RefundAccount = { bankName: '', accountNumber: '', accountName: '' };

/** Where FastDemo transfers a refund of this order (cancelled, auto refund, dispute split). Admins see it on the refund. */
export default function RefundAccountCard({ orderId }: { orderId: string }) {
  const [saved, setSaved] = useState<RefundAccount | null | undefined>(undefined);
  const [form, setForm] = useState<RefundAccount>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRefundAccount(orderId).then(
      (a) => {
        setSaved(a);
        setEditing(!a);
        if (a) setForm(a);
      },
      () => setError('Không tải được tài khoản nhận hoàn.'),
    );
  }, [orderId]);

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
    } catch {
      setError('Chưa lưu được, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof RefundAccount, label: string, extra: object = {}) => (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        className="mt-1 min-h-[44px] w-full px-3 py-2 !text-base"
        value={form[key]}
        disabled={busy}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...extra}
      />
    </label>
  );

  return (
    <section className="card space-y-3" aria-labelledby="refund-account-title">
      <h2 id="refund-account-title" className="font-display text-base font-bold text-ink">Tài khoản nhận hoàn tiền</h2>
      <p className="text-sm text-slate-600">Nếu đơn bị huỷ hoặc được hoàn một phần, {BRAND.name} chuyển trả vào tài khoản này.</p>
      {saved === undefined && !error && <p className="text-sm text-slate-500">Đang tải…</p>}
      {saved && !editing && (
        <div className="flex items-start justify-between gap-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-slate-500">Ngân hàng</dt><dd className="font-semibold">{saved.bankName}</dd>
            <dt className="text-slate-500">Số tài khoản</dt><dd className="font-mono font-semibold">{saved.accountNumber}</dd>
            <dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-semibold">{saved.accountName}</dd>
          </dl>
          <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setEditing(true)}>Sửa</button>
        </div>
      )}
      {editing && saved !== undefined && (
        <div className="space-y-3">
          {field('bankName', 'Ngân hàng', { placeholder: 'VD: MB Bank', autoComplete: 'off' })}
          {field('accountNumber', 'Số tài khoản', { inputMode: 'numeric', placeholder: 'Chỉ chữ số', autoComplete: 'off' })}
          {field('accountName', 'Chủ tài khoản', { placeholder: 'VD: NGUYEN VAN A', autoCapitalize: 'characters', autoComplete: 'off' })}
          <button type="button" className="btn-primary min-h-[44px] w-full" disabled={busy} onClick={save}>
            {busy ? 'Đang lưu…' : 'Lưu tài khoản nhận hoàn'}
          </button>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </section>
  );
}
