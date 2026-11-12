'use client';

import { useEffect, useState } from 'react';
import type { Payout, PayoutList } from '@grabcode/contracts/schemas';
import { API_URL } from '../lib/auth';
import { formatVnd } from '../lib/coderStore';

const LABEL: Record<Payout['status'], string> = { PENDING: 'Chờ duyệt', PAID: 'Đã chuyển', REJECTED: 'Từ chối' };

/** Wallet withdrawal (S7): request goes to admin for manual bank transfer. API mode only. */
export default function PayoutCard() {
  const [list, setList] = useState<Payout[]>([]);
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`${API_URL}/v1/me/payouts`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PayoutList>) : null))
      .then((d) => d && setList(d.payouts))
      .catch(() => {});
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
        setMsg('Đã gửi yêu cầu, chờ admin chuyển khoản.');
        await load();
      } else setMsg(r.status === 409 ? 'Vượt số dư khả dụng (trừ yêu cầu đang chờ).' : r.status === 400 ? 'Tối thiểu 10.000 ₫, STK 5-200 ký tự.' : `Lỗi ${r.status}`);
    } catch {
      setMsg('Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3 className="font-display text-sm font-bold">Rút tiền về ngân hàng</h3>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-2 text-sm">
        <input className="rounded border border-slate-200 px-3 py-2" type="number" min={10000} step={1000} required placeholder="Số tiền (₫)" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Số tiền rút" />
        <input className="rounded border border-slate-200 px-3 py-2" required minLength={5} maxLength={200} placeholder="Ngân hàng, STK, chủ tài khoản" value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Tài khoản ngân hàng" />
        <button type="submit" disabled={busy} className="btn-secondary min-h-[44px]">
          {busy ? 'Đang gửi…' : 'Gửi yêu cầu rút'}
        </button>
        {msg && <p className="text-xs text-slate-600" role="status">{msg}</p>}
      </form>
      {list.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{formatVnd(p.amountVnd)}</span>
              <span className={p.status === 'PAID' ? 'chip-ok' : 'text-xs text-slate-500'} title={p.note ?? undefined}>{LABEL[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
