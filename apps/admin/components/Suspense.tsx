'use client';

import { useState } from 'react';
import type { SuspenseItem, SuspenseList } from '@grabcode/contracts/schemas';
import { api, vnd, when } from '../lib/api';
import { Table, loadingOf, useList } from './ui';

export default function Suspense() {
  const { data, error, busy, act } = useList<SuspenseList>('/v1/admin/suspense');
  const [target, setTarget] = useState<Record<string, string>>({});
  const resolve = (i: SuspenseItem, orderId: string | null) =>
    act(() => api(`/v1/admin/suspense/${encodeURIComponent(i.txId)}/resolve`, 'POST', { orderId }));
  return (
    <Table head={['Giao dịch', 'Số tiền', 'Nội dung CK', 'Xử lý']} empty="Không có giao dịch treo." error={error} loading={loadingOf(data, error)}>
      {(data?.items ?? []).map((i) => (
        <tr key={i.txId}>
          <td>
            <span className="font-mono text-xs">{i.txId}</span>
            <div className="text-xs text-stone-600">{when(i.createdAt)}</div>
          </td>
          <td className="num font-bold">{vnd(i.amountVnd)}</td>
          <td className="max-w-xs wrap-break-word font-mono">{i.content}</td>
          <td>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-h-[36px] w-32 px-2"
                placeholder="GC-1234"
                aria-label={`Mã đơn nhận tiền của ${i.txId}`}
                value={target[i.txId] ?? ''}
                onChange={(e) => setTarget({ ...target, [i.txId]: e.target.value.trim().toUpperCase() })}
              />
              <button className="btn-primary btn-compact" disabled={busy || !target[i.txId]} onClick={() => resolve(i, target[i.txId])}>
                Gán vào đơn
              </button>
              <button className="btn-outline btn-compact" disabled={busy} onClick={() => confirm(`Hoàn ${vnd(i.amountVnd)} cho người chuyển?`) && resolve(i, null)}>
                Hoàn lại
              </button>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}
