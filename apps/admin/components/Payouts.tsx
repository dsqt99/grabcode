'use client';

import type { Payout, PayoutList } from '@grabcode/contracts/schemas';
import { api, vnd, when } from '../lib/api';
import { Chip, Table, loadingOf, useList } from './ui';

const STATUS: Record<Payout['status'], React.ReactNode> = {
  PENDING: <Chip tone="warn">Chờ duyệt</Chip>,
  PAID: <Chip tone="success">Đã chuyển</Chip>,
  REJECTED: <Chip tone="danger">Từ chối</Chip>,
};

export default function Payouts() {
  const { data, error, busy, act } = useList<PayoutList>('/v1/admin/payouts');
  const decide = (p: Payout, approve: boolean) => {
    const note = approve ? undefined : (prompt('Lý do từ chối?') ?? undefined);
    if (approve && !confirm(`Đã chuyển ${vnd(p.amountVnd)} tới "${p.bankAccount}"? Ví coder sẽ bị trừ.`)) return;
    void act(() => api(`/v1/admin/payouts/${p.id}/decide`, 'POST', { approve, note }));
  };
  return (
    <Table head={['Coder', 'Số tiền', 'Tài khoản nhận', 'Trạng thái', '']} empty="Chưa có yêu cầu rút tiền." error={error} loading={loadingOf(data, error)}>
      {(data?.payouts ?? []).map((p) => (
        <tr key={p.id}>
          <td>
            <b>{p.coderName}</b>
            <div className="text-xs text-stone-600">{when(p.createdAt)}</div>
          </td>
          <td className="num font-bold">{vnd(p.amountVnd)}</td>
          <td className="font-mono">{p.bankAccount}</td>
          <td>
            {STATUS[p.status]}
            {p.note && <div className="mt-1 text-xs text-stone-600">{p.note}</div>}
          </td>
          <td>
            {p.status === 'PENDING' && (
              <div className="flex gap-2">
                <button className="btn-primary btn-compact" disabled={busy} onClick={() => decide(p, true)}>Đã chuyển</button>
                <button className="btn-outline btn-compact" disabled={busy} onClick={() => decide(p, false)}>Từ chối</button>
              </div>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}
