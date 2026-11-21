'use client';

import type { Monitor } from '@grabcode/contracts/schemas';
import { api, when } from '../lib/api';
import { Table, loadingOf, useList } from './ui';

export default function MonitorView() {
  const { data, error, busy, act, load } = useList<Monitor>('/v1/admin/monitor');
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-6 !p-4 text-sm tabular-nums">
        <span>Outbox chờ relay: <b>{data?.outboxPending ?? '…'}</b>{data?.outboxOldestSeconds != null && ` (cũ nhất ${data.outboxOldestSeconds}s)`}</span>
        <span>Realtime chờ Centrifugo: <b>{data?.realtimePending ?? '…'}</b></span>
        <button className="btn-outline btn-compact" onClick={() => void load()}>Làm mới</button>
      </div>
      <Table head={['Consumer JetStream', 'Pending', 'Ack pending', 'Redelivered']} empty={data?.consumers === null ? 'Không kết nối được NATS.' : 'Không có consumer.'} error={null} loading={loadingOf(data, error)}>
        {(data?.consumers ?? []).map((c) => (
          <tr key={c.name}>
            <td>{c.name}</td>
            <td className="tabular-nums">{c.pending}</td>
            <td className="tabular-nums">{c.ackPending}</td>
            <td className="tabular-nums">{c.redelivered}</td>
          </tr>
        ))}
      </Table>
      <Table head={['Job lỗi', 'Đơn', 'Lỗi', '']} empty="Không có job FAILED." error={error} loading={loadingOf(data, error)}>
        {(data?.failedJobs ?? []).map((j) => (
          <tr key={`${j.kind}:${j.id}`}>
            <td>
              {j.kind}
              <div className="text-xs text-stone-600">{when(j.updatedAt)}</div>
            </td>
            <td>{j.orderId ?? '—'}</td>
            <td className="max-w-md break-words text-xs">{j.error}</td>
            <td>
              {j.retryable && (
                <button className="btn-primary btn-compact" disabled={busy} onClick={() => act(() => api(`/v1/admin/jobs/${j.kind}/${j.orderId}/retry`, 'POST'))}>
                  Thử lại
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
