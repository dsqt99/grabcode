'use client';

import { useState } from 'react';
import type { Refund, RefundList } from '@grabcode/contracts/schemas';
import { api, vnd, when } from '../lib/api';
import { Chip, Table, Toolbar, loadingOf, useList } from './ui';

/** B2: every refund booked in the ledger waits here until the admin has really transferred it back. */
export default function Refunds() {
  const [view, setView] = useState<'PENDING' | 'all'>('PENDING');
  const { data, error, busy, act } = useList<RefundList>(`/v1/admin/refunds?status=${view}`);
  const [ref, setRef] = useState<Record<string, string>>({});
  const paid = (r: Refund) => {
    const reference = ref[r.id]?.trim();
    if (!reference) return alert('Nhập mã giao dịch chuyển trả (để tránh ghi trùng).');
    const to = r.refundAccount ? `${r.refundAccount.bankName} ${r.refundAccount.accountNumber} (${r.refundAccount.accountName})` : 'người chuyển';
    if (confirm(`Đã chuyển ${vnd(r.amountVnd)} tới ${to}, mã GD ${reference}?`)) void act(() => api(`/v1/admin/refunds/${r.id}/paid`, 'POST', { reference }));
  };
  return (
    <>
      <Toolbar>
        <button className={`btn-compact ${view === 'PENDING' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('PENDING')}>Chờ chuyển trả</button>
        <button className={`btn-compact ${view === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('all')}>Tất cả</button>
      </Toolbar>
      <div className="banner-info">
        <span className="material-symbols-outlined" aria-hidden>info</span>
        <p>Hoàn tiền trong hệ thống chỉ là ghi sổ: chuyển khoản tay cho khách rồi bấm &quot;Đã chuyển&quot;.</p>
      </div>
      <Table head={['Đơn', 'Số tiền', 'Chuyển tới', 'Lúc ghi sổ', 'Xử lý']} empty="Không có khoản chờ chuyển trả." error={error} loading={loadingOf(data, error)}>
        {(data?.refunds ?? []).map((r) => (
          <tr key={r.id}>
            <td>
              <b>{r.orderId ?? 'Suspense'}</b>
              <div className="text-xs text-stone-600">
                {r.customerName}
                {r.customerEmail && ` (${r.customerEmail})`}
              </div>
            </td>
            <td className="num font-bold">{vnd(r.amountVnd)}</td>
            <td>
              {r.refundAccount ? (
                <>
                  {r.refundAccount.bankName} · <span className="font-mono font-bold">{r.refundAccount.accountNumber}</span>
                  <div className="text-xs">{r.refundAccount.accountName}</div>
                </>
              ) : r.transferContent !== null ? (
                <span className="text-xs">Người chuyển nội dung &quot;{r.transferContent}&quot; (tra sao kê)</span>
              ) : (
                <Chip tone="warn">Khách chưa nhập STK, liên hệ khách</Chip>
              )}
            </td>
            <td className="text-xs">{when(r.createdAt)}</td>
            <td>
              {r.status === 'PAID' ? (
                <div className="text-xs">
                  <Chip tone="success">Đã chuyển</Chip>
                  <div className="mt-1 font-mono">{r.reference}</div>
                  {r.paidAt && <div>{when(r.paidAt)}</div>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-h-[36px] w-36 px-2"
                    aria-label={`Mã giao dịch chuyển trả của ${r.orderId ?? r.txId}`}
                    placeholder="Mã GD (FT...)"
                    value={ref[r.id] ?? ''}
                    onChange={(e) => setRef({ ...ref, [r.id]: e.target.value })}
                  />
                  <button className="btn-primary btn-compact" disabled={busy} onClick={() => paid(r)}>
                    Đã chuyển
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
