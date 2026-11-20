'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderDto } from '@grabcode/contracts/schemas';
import { formatVnd, listJobs } from '../lib/coderStore';

const REFRESH_MS = 15_000;

/** Paid orders nobody took yet. Works without going online: the freelancer browses and claims one. */
export default function JobBoard({ onClaim }: { onClaim: (orderId: string) => Promise<unknown> }) {
  const [jobs, setJobs] = useState<OrderDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => listJobs().then(setJobs, console.warn), []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const claim = async (id: string) => {
    setBusy(id);
    await onClaim(id).catch(() => load());
    setBusy(null);
  };

  return (
    <section className="card" aria-label="Việc đang chờ nhận">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold">Việc đang chờ nhận</h3>
        <button type="button" onClick={load} className="text-xs font-semibold text-emerald-dark">
          Làm mới
        </button>
      </div>
      {jobs === null ? (
        <p className="mt-2 text-sm text-slate-500">Đang tải...</p>
      ) : jobs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Chưa có đơn nào đã thanh toán đang chờ. Bật Online để nhận thông báo đơn mới.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {j.id} · {j.customer.name} · dự kiến ~{j.etaHours} giờ
                  </p>
                  <p className="font-display text-sm font-bold text-ink">{j.title}</p>
                </div>
                <span className="chip-ok shrink-0">{formatVnd(j.payoutVnd)}</span>
              </div>
              <p className="line-clamp-3 text-xs text-slate-600">{j.brief.scopeSummary || j.prompt}</p>
              <p className="text-xs text-slate-500">{j.brief.milestones.length} mốc · bạn nhận {formatVnd(j.payoutVnd)} khi khách duyệt hết các mốc</p>
              <button type="button" disabled={busy !== null} onClick={() => claim(j.id)} className="btn-primary min-h-[44px] w-full">
                {busy === j.id ? 'Đang nhận...' : 'Nhận việc này'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
