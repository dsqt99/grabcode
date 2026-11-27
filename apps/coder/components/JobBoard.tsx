'use client';

import { useCallback, useEffect, useState } from 'react';
import { etaLabel, type OrderDto } from '@grabcode/contracts/schemas';
import { formatVnd, listJobs } from '../lib/coderStore';

const REFRESH_MS = 15_000;

/** Paid orders nobody took yet. Works without going online: the freelancer browses and claims one. */
export default function JobBoard({ onClaim }: { onClaim: (orderId: string) => Promise<unknown> }) {
  const [jobs, setJobs] = useState<OrderDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listJobs().then(
        (j) => (setFailed(false), setJobs(j)),
        (e) => (console.warn(e), setFailed(true)),
      ),
    [],
  );
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
    <section className="space-y-3" aria-label="Việc đang chờ nhận">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Việc đang chờ nhận</h2>
        <button type="button" onClick={load} className="btn-ghost btn-sm">
          <span className="material-symbols-outlined text-[20px]!" aria-hidden>refresh</span> Làm mới
        </button>
      </div>
      {failed && (
        <div className="banner-danger" role="alert">
          <span className="material-symbols-outlined" aria-hidden>error</span>
          <div className="flex-1">
            <p>Không tải được danh sách việc. Kiểm tra kết nối rồi thử lại.</p>
            <button type="button" onClick={load} className="btn-outline btn-sm mt-2">Thử lại</button>
          </div>
        </div>
      )}
      {jobs === null ? (
        !failed && (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only">Đang tải danh sách việc</span>
            <div className="skeleton h-[180px]" />
            <div className="skeleton h-[180px]" />
          </div>
        )
      ) : jobs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-600">
            <span className="material-symbols-outlined text-[40px]!" aria-hidden>inbox</span>
          </span>
          <h3 className="font-display text-base font-bold">Chưa có việc nào đang chờ</h3>
          <p className="text-sm text-stone-600">Việc đã được khách thanh toán sẽ hiện ở đây. Bật nhận đơn để được báo khi có việc mới.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id} className="card space-y-3">
              <p className="text-xs text-stone-600">{j.id} · {j.customer.name} · {etaLabel(j.etaHours)}</p>
              <h3 className="line-clamp-2 font-display text-base font-bold text-stone-900">{j.title}</h3>
              <div className="rounded-xl bg-teal-50 p-3">
                <p className="text-xs text-teal-800">Bạn nhận</p>
                <p className="font-display text-[28px] font-extrabold tabular-nums text-teal-800">{formatVnd(j.payoutVnd)}</p>
              </div>
              <p className="line-clamp-3 text-sm text-stone-700">{j.brief.scopeSummary || j.prompt}</p>
              <p className="help mt-0!">{j.brief.milestones.length} mốc · tiền trả theo từng mốc khách duyệt, mốc cuối khi khách nghiệm thu.</p>
              <button type="button" disabled={busy !== null} onClick={() => claim(j.id)} className="btn-primary w-full">
                {busy === j.id ? 'Đang nhận…' : 'Nhận việc này'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
