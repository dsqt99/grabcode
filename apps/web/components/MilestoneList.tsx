import type { Milestone } from '@grabcode/contracts';
import { formatTime } from '../lib/orderView';
import { formatVnd } from '../lib/pricing';

const META = {
  COMPLETED: { icon: 'check_circle', cls: 'text-emerald', label: 'Hoàn thành' },
  SUBMITTED: { icon: 'rate_review', cls: 'text-amber', label: 'Chờ bạn duyệt' },
  IN_PROGRESS: { icon: 'progress_activity', cls: 'text-amber', label: 'Đang làm' },
  PENDING: { icon: 'radio_button_unchecked', cls: 'text-slate-300', label: 'Chờ' },
} as const;

const QA = {
  RUNNING: { cls: 'chip bg-slate-100 text-slate-700', label: 'Đang kiểm tra tự động' },
  PASSED: { cls: 'chip-ok', label: 'Kiểm tra tự động: đạt' },
  FAILED: { cls: 'chip bg-red-50 text-red-700', label: 'Kiểm tra tự động: không đạt' },
  SKIPPED: { cls: 'chip bg-slate-100 text-slate-700', label: 'Chưa kiểm tra tự động' },
  ERROR: { cls: 'chip bg-slate-100 text-slate-700', label: 'Kiểm tra tự động bị lỗi' },
} as const;

const CHECK: Record<string, string> = { PASSED: 'đạt', FAILED: 'không đạt', SKIPPED: 'bỏ qua', RUNNING: 'đang chạy', ERROR: 'lỗi' };

/**
 * `onReview` (API mode, order IN_PROGRESS) shows approve / request-changes on the SUBMITTED milestone; the page opens
 * a confirmation sheet for both. `amountOf`: escrow share of the milestone (VND). `paysOnApproval`: false for the last
 * milestone, whose share is only paid when the whole order is accepted.
 */
export default function MilestoneList({
  milestones,
  onReview,
  amountOf,
  paysOnApproval = () => true,
}: {
  milestones: Milestone[];
  onReview?: (milestoneId: string, approve: boolean) => void;
  amountOf?: (milestoneId: string) => number;
  paysOnApproval?: (milestoneId: string) => boolean;
}) {
  return (
    <section aria-label="Các mốc bàn giao" className="space-y-3">
      <h2 className="font-display text-base font-bold text-ink">Mốc bàn giao</h2>
      {milestones.map((m) => {
        const meta = META[m.status];
        return (
          <article
            key={m.id}
            className={`card !p-4 transition ${m.status === 'IN_PROGRESS' || m.status === 'SUBMITTED' ? 'border-emerald/50 shadow-l2' : ''} ${m.status === 'COMPLETED' ? 'bg-emerald-mint/40' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined ${meta.cls} ${m.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} aria-hidden>{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-ink">[{m.id}] {m.title}</span>
                  <span className="shrink-0 font-display text-sm font-extrabold text-emerald-dark">{amountOf ? formatVnd(amountOf(m.id)) : `${m.weightPercent}%`}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{m.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={m.status === 'COMPLETED' ? 'chip-ok' : m.status === 'IN_PROGRESS' ? 'chip-warn' : 'chip bg-slate-100 text-slate-700'}>{meta.label}</span>
                  {m.commitHash && <code className="rounded bg-ink px-2 py-0.5 font-mono text-[11px] text-emerald">{m.commitHash}</code>}
                  {m.qa && <span className={QA[m.qa.status].cls}>{QA[m.qa.status].label}</span>}
                  {m.completedAt && <span className="text-xs text-slate-600">{formatTime(m.completedAt)}</span>}
                </div>
                {m.deliveryUrl && (
                  <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex min-h-[44px] max-w-full items-center gap-1 text-sm font-semibold text-emerald-dark underline">
                    <span className="material-symbols-outlined !text-[16px]" aria-hidden>link</span>
                    <span className="truncate">Xem bàn giao: {m.deliveryUrl}</span>
                  </a>
                )}
                {m.qa && m.qa.checks.length > 0 && (
                  <details className="mt-2 text-xs text-slate-600">
                    <summary className="min-h-[44px] cursor-pointer py-3">Chi tiết kiểm tra tự động</summary>
                    <ul className="mt-1 space-y-1">
                      {m.qa.checks.map((c) => (
                        <li key={c.name}>
                          <span className={c.status === 'FAILED' ? 'font-semibold text-red-600' : c.status === 'PASSED' ? 'text-emerald-dark' : 'text-slate-600'}>
                            {c.name}: {CHECK[c.status] ?? c.status}
                          </span>
                          {c.status === 'FAILED' && c.detail && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px]">{c.detail}</pre>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {m.note && m.status !== 'COMPLETED' && (
                  <p className="mt-2 text-xs text-slate-600">{m.status === 'SUBMITTED' ? 'Freelancer ghi chú' : 'Bạn yêu cầu sửa'}: {m.note}</p>
                )}
                {m.status === 'SUBMITTED' && onReview && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary !min-h-[44px] flex-1 !py-1 text-sm"
                      disabled={m.qa?.status === 'FAILED'}
                      title={m.qa?.status === 'FAILED' ? 'Kiểm tra tự động chưa đạt — hãy yêu cầu freelancer sửa trước' : undefined}
                      onClick={() => onReview(m.id, true)}
                    >
                      {amountOf && paysOnApproval(m.id) ? `Duyệt & trả ${formatVnd(amountOf(m.id))}` : 'Duyệt mốc'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !min-h-[44px] flex-1 !py-1 text-sm"
                      onClick={() => onReview(m.id, false)}
                    >
                      Yêu cầu sửa
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
