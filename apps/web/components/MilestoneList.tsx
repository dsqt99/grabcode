import type { Milestone } from '@grabcode/contracts';
import { formatTime } from '../lib/orderView';
import { formatVnd } from '../lib/pricing';

const META = {
  COMPLETED: { dot: 'bg-teal-600 text-white', icon: 'check', chip: 'chip-success', label: 'Hoàn thành' },
  SUBMITTED: { dot: 'bg-amber-500 text-white', icon: 'rate_review', chip: 'chip-warn', label: 'Chờ bạn duyệt' },
  IN_PROGRESS: { dot: 'bg-brand-600 text-white', icon: null, chip: 'chip-progress', label: 'Đang làm' },
  PENDING: { dot: 'border-2 border-stone-300 bg-white text-stone-600', icon: null, chip: 'chip-neutral', label: 'Chờ' },
} as const;

const QA = {
  RUNNING: { cls: 'chip-neutral', label: 'Đang kiểm tra tự động' },
  PASSED: { cls: 'chip-success', label: 'Kiểm tra tự động: đạt' },
  FAILED: { cls: 'chip-danger', label: 'Kiểm tra tự động: không đạt' },
  SKIPPED: { cls: 'chip-neutral', label: 'Chưa kiểm tra tự động' },
  ERROR: { cls: 'chip-neutral', label: 'Kiểm tra tự động bị lỗi' },
} as const;

const CHECK: Record<string, string> = { PASSED: 'đạt', FAILED: 'không đạt', SKIPPED: 'bỏ qua', RUNNING: 'đang chạy', ERROR: 'lỗi' };

function QaDetails({ m }: { m: Milestone }) {
  if (!m.qa || m.qa.checks.length === 0) return null;
  return (
    <details className="text-sm text-stone-600">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-semibold text-stone-700">Chi tiết kiểm tra tự động</summary>
      <ul className="mt-1 space-y-1">
        {m.qa.checks.map((c) => (
          <li key={c.name}>
            <span className={c.status === 'FAILED' ? 'font-semibold text-red-700' : c.status === 'PASSED' ? 'text-teal-700' : 'text-stone-600'}>
              {c.name}: {CHECK[c.status] ?? c.status}
            </span>
            {c.status === 'FAILED' && c.detail && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-100 p-2 font-mono text-xs text-stone-700">{c.detail}</pre>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Approve / request changes on a SUBMITTED milestone; approving stays locked (with the reason shown) while QA failed. */
function ReviewActions({ m, approveLabel, onReview }: { m: Milestone; approveLabel: string; onReview: (milestoneId: string, approve: boolean) => void }) {
  const qaFailed = m.qa?.status === 'FAILED';
  return (
    <div className="space-y-2">
      {qaFailed && (
        <p className="error-text">
          <span className="material-symbols-outlined text-[20px]!" aria-hidden>error</span>
          Kiểm tra tự động chưa đạt — hãy yêu cầu freelancer sửa trước.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-primary flex-2" disabled={qaFailed} onClick={() => onReview(m.id, true)}>
          {approveLabel}
        </button>
        <button type="button" className="btn-outline flex-1" onClick={() => onReview(m.id, false)}>
          Yêu cầu sửa
        </button>
      </div>
    </div>
  );
}

const approveLabelOf = (m: Milestone, amountOf?: (id: string) => number, paysOnApproval?: (id: string) => boolean) =>
  amountOf && paysOnApproval?.(m.id) ? `Duyệt & trả ${formatVnd(amountOf(m.id))}` : 'Duyệt mốc cuối';

/**
 * The milestone waiting for the customer, expanded in the order page's action block (redesign-web-order §5): delivery
 * link, freelancer note, QA and the review buttons right under the status card.
 */
export function SubmittedMilestone({
  milestone: m,
  onReview,
  amountOf,
  paysOnApproval = () => true,
}: {
  milestone: Milestone;
  onReview?: (milestoneId: string, approve: boolean) => void;
  amountOf?: (milestoneId: string) => number;
  paysOnApproval?: (milestoneId: string) => boolean;
}) {
  return (
    <section aria-labelledby="review-title" className="card-action space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="chip-warn">Chờ bạn duyệt</span>
          <h2 id="review-title" className="mt-2 font-display text-lg font-bold text-stone-900 md:text-xl">
            {m.id} · {m.title}
          </h2>
        </div>
        {amountOf && <span className="shrink-0 pt-8 font-display font-bold tabular-nums text-stone-900">{formatVnd(amountOf(m.id))}</span>}
      </div>
      {m.deliveryUrl ? (
        <div className="space-y-1">
          <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-outline btn-sm">
            <span className="material-symbols-outlined text-[20px]!" aria-hidden>open_in_new</span>
            Mở bản bàn giao
          </a>
          <p className="truncate text-xs text-stone-600">{m.deliveryUrl}</p>
        </div>
      ) : (
        <p className="text-sm text-stone-600">Freelancer chưa gửi link bàn giao cho mốc này.</p>
      )}
      {m.note && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">Ghi chú của freelancer: “{m.note}”</p>}
      {m.qa && <span className={QA[m.qa.status].cls}>{QA[m.qa.status].label}</span>}
      <QaDetails m={m} />
      {!paysOnApproval(m.id) && <p className="help">Tiền mốc cuối trả khi bạn nghiệm thu cả đơn.</p>}
      {onReview && <ReviewActions m={m} approveLabel={approveLabelOf(m, amountOf, paysOnApproval)} onReview={onReview} />}
    </section>
  );
}

/**
 * Vertical milestone timeline. `onReview` (API mode, order IN_PROGRESS) shows approve / request-changes on the SUBMITTED
 * milestone; leave it out when that milestone is already expanded in the action block (`SubmittedMilestone`).
 * `amountOf`: escrow share of the milestone (VND). `paysOnApproval`: false for the last milestone, whose share is only
 * paid when the whole order is accepted.
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
    <section aria-labelledby="milestones-title" className="card">
      <h2 id="milestones-title" className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-stone-900">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>flag</span>
        Mốc bàn giao
      </h2>
      <ol>
        {milestones.map((m, i) => {
          const meta = META[m.status];
          const last = i === milestones.length - 1;
          return (
            <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span className="absolute bottom-0 left-4 top-8 w-px bg-stone-200" aria-hidden />}
              <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${meta.dot}`} aria-hidden>
                {meta.icon ? <span className="material-symbols-outlined text-[18px]!">{meta.icon}</span> : i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-stone-900">{m.id} · {m.title}</h3>
                  <span className="shrink-0 font-display font-bold tabular-nums text-stone-900">{amountOf ? formatVnd(amountOf(m.id)) : `${m.weightPercent}%`}</span>
                </div>
                <p className="text-sm text-stone-600">{m.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={meta.chip}>{meta.label}</span>
                  {m.qa && <span className={QA[m.qa.status].cls}>{QA[m.qa.status].label}</span>}
                  {m.commitHash && <code className="rounded-sm bg-stone-100 px-1.5 font-mono text-xs text-stone-700">{m.commitHash}</code>}
                  {m.completedAt && <span className="text-xs text-stone-600">{formatTime(m.completedAt)}</span>}
                </div>
                {last && paysOnApproval && !paysOnApproval(m.id) && m.status !== 'COMPLETED' && (
                  <p className="text-sm text-stone-600">Tiền mốc cuối trả khi bạn nghiệm thu cả đơn.</p>
                )}
                {m.note && m.status === 'IN_PROGRESS' && (
                  <p className="banner-warn p-3!">Bạn yêu cầu sửa: {m.note}</p>
                )}
                {m.deliveryUrl && (
                  <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[44px] max-w-full items-center gap-1 text-sm font-semibold text-brand-800 underline">
                    <span className="material-symbols-outlined text-[16px]!" aria-hidden>open_in_new</span>
                    <span className="truncate">Mở bản bàn giao</span>
                  </a>
                )}
                {m.status === 'SUBMITTED' && onReview && <ReviewActions m={m} approveLabel={approveLabelOf(m, amountOf, paysOnApproval)} onReview={onReview} />}
                {m.status !== 'SUBMITTED' && <QaDetails m={m} />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
