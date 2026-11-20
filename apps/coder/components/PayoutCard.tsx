'use client';

import { useEffect, useState } from 'react';
import type { Payout, PayoutList } from '@grabcode/contracts/schemas';
import { API_URL } from '@grabcode/auth-ui';
import { formatVnd } from '../lib/coderStore';

const LABEL: Record<Payout['status'], string> = { PENDING: 'Chờ duyệt', PAID: 'Đã chuyển', REJECTED: 'Từ chối' };
const CHIP: Record<Payout['status'], string> = { PENDING: 'chip-warn', PAID: 'chip-success', REJECTED: 'chip-danger' };
const day = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Wallet withdrawal (S7): request goes to admin for manual bank transfer. API mode only. */
export default function PayoutCard({ walletVnd }: { walletVnd?: number }) {
  const [list, setList] = useState<Payout[]>([]);
  const [listFailed, setListFailed] = useState(false);
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`${API_URL}/v1/me/payouts`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PayoutList>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => (setList(d.payouts), setListFailed(false)))
      .catch(() => setListFailed(true));
  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_URL}/v1/me/payouts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountVnd: Number(amount), bankAccount: bank }),
      });
      if (r.ok) {
        setAmount('');
        setMsg({ ok: true, text: 'Đã gửi yêu cầu. Admin chuyển khoản tay và cập nhật trạng thái tại đây.' });
        await load();
      } else
        setMsg({
          ok: false,
          text: r.status === 409 ? 'Vượt số dư khả dụng (trừ yêu cầu đang chờ).' : r.status === 400 ? 'Tối thiểu 10.000 đ, STK 5-200 ký tự.' : `Lỗi ${r.status}`,
        });
    } catch {
      setMsg({ ok: false, text: 'Không kết nối được máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3" aria-labelledby="payout-title">
      <div>
        <h2 id="payout-title" className="font-display text-lg font-bold">Rút tiền về ngân hàng</h2>
        {walletVnd !== undefined && <p className="text-sm text-stone-600">Số dư khả dụng: <b className="tabular-nums text-stone-900">{formatVnd(walletVnd)}</b></p>}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="payout-amount" className="label">Số tiền (đ)</label>
          <input id="payout-amount" className="field" inputMode="numeric" pattern="[0-9]*" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-describedby="payout-amount-help" />
          <span id="payout-amount-help" className="help">Tối thiểu 10.000 đ.</span>
        </div>
        <div>
          <label htmlFor="payout-bank" className="label">Tài khoản nhận</label>
          <input id="payout-bank" className="field" required minLength={5} maxLength={200} placeholder="VD: MB Bank · 0123456789 · NGUYEN VAN A" value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <span className="material-symbols-outlined spinner" aria-hidden>progress_activity</span>}
          {busy ? 'Đang gửi…' : 'Gửi yêu cầu rút'}
        </button>
        {msg && (
          <div className={msg.ok ? 'banner-success' : 'banner-danger'} role={msg.ok ? 'status' : 'alert'}>
            <span className="material-symbols-outlined" aria-hidden>{msg.ok ? 'check_circle' : 'error'}</span>
            <p>{msg.text}</p>
          </div>
        )}
      </form>
      {listFailed && <p className="help" role="status">Chưa tải được lịch sử rút tiền.</p>}
      {list.length > 0 && (
        <ul className="divide-y divide-stone-100">
          {list.map((p) => (
            <li key={p.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold tabular-nums">{formatVnd(p.amountVnd)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-stone-600">{day(p.createdAt)}</span>
                  <span className={CHIP[p.status]}>{LABEL[p.status]}</span>
                </span>
              </div>
              {p.status === 'REJECTED' && p.note && <p className="mt-1 text-sm text-red-700">Lý do: {p.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
