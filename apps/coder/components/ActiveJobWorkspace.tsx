'use client';

import { useState } from 'react';
import type { CoderState, HandIn } from '../lib/coderStore';
import { formatVnd, getMilestones, repoUrlOf } from '../lib/coderStore';
import { BRAND } from '@grabcode/contracts';
import { useOrderRepo } from '../lib/repo';
import CoderChat from './CoderChat';
import Sheet from './Sheet';

export default function ActiveJobWorkspace({
  state,
  onCompleteMilestone,
  onDeliver,
  onSendChat,
  onDismiss,
}: {
  state: CoderState;
  onCompleteMilestone: (id: string, handIn?: HandIn) => void;
  onDeliver: () => void;
  onSendChat: (text: string) => void;
  onDismiss: () => void;
}) {
  const order = state.activeOrder;
  const [copied, setCopied] = useState(false);
  // API mode: the hand-in form (link + note) for the current milestone.
  const [handIn, setHandIn] = useState<{ url: string; note: string } | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const real = useOrderRepo(order);
  if (!order) return null;
  const disputed = order.serverStatus === 'DISPUTED';

  const milestones = getMilestones(order);
  const done = state.completedMilestones;
  const nextIdx = milestones.findIndex((m) => !done.includes(m.id));
  const allDone = nextIdx === -1;
  const progress = milestones.reduce((sum, m) => sum + (done.includes(m.id) ? m.weightPercent : 0), 0);
  // Real repo from repo-worker when the API is on; mock URL in mock mode.
  const gh = real?.repo;
  const ready = !real || gh?.status === 'READY';
  const repo = real ? (gh?.htmlUrl ?? '') : repoUrlOf(order);
  const cloneCmd = real ? (gh?.cloneUrl ? `git clone ${gh.cloneUrl}` : real.error || gh?.status === 'FAILED' ? 'Chưa có repo' : 'Đang tạo repo riêng cho đơn…') : `git clone ${repo}.git`;

  const downloadClaudeMd = () => {
    try {
      const blob = new Blob([order.brief.claudeMdContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CLAUDE.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* ignore */
    }
  };

  const copyClone = async () => {
    try {
      await navigator.clipboard.writeText(cloneCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const cur = allDone ? null : milestones[nextIdx];
  const isLast = nextIdx === milestones.length - 1;
  const submitted = cur?.status === 'SUBMITTED';
  const failedQa = cur?.qa?.status === 'FAILED' && cur.status !== 'COMPLETED' ? cur.qa.checks.filter((c) => c.status === 'FAILED') : [];
  const redo = cur && cur.status === 'IN_PROGRESS' && cur.note ? cur.note : null;
  const openHandIn = () => (real ? (setUrlTouched(false), setHandIn({ url: '', note: '' })) : cur && onCompleteMilestone(cur.id));
  const urlBad = !!handIn && handIn.url.trim() !== '' && !/^https?:\/\//.test(handIn.url.trim());
  const submitLabel = cur ? (redo ? `Nộp lại ${cur.id}` : real ? `Nộp ${cur.id}` : `Xong ${cur.id}`) : '';

  const chip = disputed ? (
    <span className="chip-danger">Đang tranh chấp · {order.id}</span>
  ) : state.completed ? (
    <span className="chip-success">Hoàn tất · {order.id}</span>
  ) : state.delivered ? (
    <span className="chip-warn">Đã nộp, chờ nghiệm thu · {order.id}</span>
  ) : (
    <span className="chip-progress">Đang làm · {order.id}</span>
  );

  return (
    <div className="flex flex-col gap-4 pb-28">
      <section className="card space-y-3">
        {chip}
        <div>
          <h2 className="font-display text-lg font-extrabold leading-tight text-stone-900">{order.title}</h2>
          <p className="mt-1 text-sm text-stone-600">{order.customerName}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-3">
          <p className="text-xs text-teal-800">Bạn nhận cả đơn</p>
          <p className="font-display text-base font-bold tabular-nums text-teal-800">{formatVnd(state.activePayoutVnd)}</p>
        </div>
        <p className="text-sm text-stone-700">{order.brief.scopeSummary}</p>
        {disputed && (
          <div className="banner-danger" role="alert">
            <span className="material-symbols-outlined" aria-hidden>gavel</span>
            <p>Khách đã mở tranh chấp. {BRAND.name} đang xem xét; tiền còn giữ tạm khoá tới khi có kết quả.</p>
          </div>
        )}
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold text-stone-600">
            <span>Tiến độ</span>
            <span className="text-brand-800">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      {!state.completed && !disputed && (
        <section className="card-action space-y-3" aria-labelledby="todo-title">
          <h2 id="todo-title" className="font-display text-lg font-bold">Việc cần làm bây giờ</h2>
          {cur ? (
            <>
              <div>
                <p className="text-sm font-semibold text-stone-900">Mốc {nextIdx + 1}/{milestones.length} · {cur.title}</p>
                <p className="text-sm text-stone-600">{cur.description}</p>
              </div>
              {redo && (
                <div className="banner-warn">
                  <span className="material-symbols-outlined" aria-hidden>edit</span>
                  <p>Khách yêu cầu sửa: {redo}</p>
                </div>
              )}
              {failedQa.length > 0 && (
                <div className="banner-danger" role="alert">
                  <span className="material-symbols-outlined" aria-hidden>error</span>
                  <div className="min-w-0 flex-1">
                    <p>Kiểm tra tự động chưa đạt: {failedQa.map((c) => c.name).join(', ')}</p>
                    <details className="mt-2">
                      <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Xem log</summary>
                      {failedQa.map((c) => (
                        <pre key={c.name} className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 font-mono text-xs text-stone-700">{c.detail}</pre>
                      ))}
                    </details>
                  </div>
                </div>
              )}
              {submitted ? (
                <div className="banner-info">
                  <span className="material-symbols-outlined" aria-hidden>schedule</span>
                  <p>Đã nộp {cur.id} — chờ khách duyệt.</p>
                </div>
              ) : (
                <button type="button" onClick={openHandIn} className="btn-primary w-full">{submitLabel}</button>
              )}
              {isLast && <p className="help !mt-0">Tiền mốc cuối được trả khi khách nghiệm thu cả đơn.</p>}
            </>
          ) : state.delivered ? (
            <div className="banner-info">
              <span className="material-symbols-outlined" aria-hidden>schedule</span>
              <p>Đã nộp bài — chờ khách nghiệm thu.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-700">Đã xong tất cả mốc.</p>
              <button type="button" onClick={onDeliver} className="btn-primary w-full">
                <span className="material-symbols-outlined" aria-hidden>inventory_2</span> Nộp bài & bàn giao
              </button>
            </>
          )}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold">Môi trường làm việc</h2>
        <div className="flex items-center gap-2 rounded-xl bg-ink p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-brand-200">{cloneCmd}</code>
          <button type="button" onClick={copyClone} disabled={!ready} className="min-h-[44px] shrink-0 rounded-full bg-white/10 px-4 text-sm font-semibold text-white active:scale-95 disabled:opacity-40">
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </div>
        {real && <RepoStatus state={real} />}
        <div className="flex flex-wrap gap-2">
          {ready && (
            <a href={repo} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
              <span className="material-symbols-outlined !text-[18px]" aria-hidden>link</span> Mở repo
            </a>
          )}
          <button type="button" onClick={downloadClaudeMd} className="btn-outline btn-sm">
            <span className="material-symbols-outlined !text-[18px]" aria-hidden>download</span> Tải CLAUDE.md
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-bold">Các mốc</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {milestones.map((m, i) => {
            const isDone = done.includes(m.id);
            const isCurrent = i === nextIdx && !state.delivered;
            const qaFailed = m.qa?.status === 'FAILED' && m.status !== 'COMPLETED';
            return (
              <li key={m.id} className={`rounded-xl border p-3 ${isDone ? 'border-teal-200 bg-teal-50' : isCurrent ? 'border-brand-600 bg-white' : 'border-stone-200 bg-stone-50'}`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                      isDone ? 'bg-teal-700 text-white' : isCurrent ? 'bg-ink text-white' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {isDone ? <span className="material-symbols-outlined !text-[18px]" aria-label="Đã xong">check</span> : m.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">{m.title}</p>
                    <p className="mt-0.5 text-sm text-stone-600">{m.description}</p>
                    {m.status === 'SUBMITTED' && <p className="mt-1 text-sm font-semibold text-amber-800">Đã nộp{m.commitHash ? ` @${m.commitHash.slice(0, 7)}` : ''} — chờ khách duyệt</p>}
                    {m.deliveryUrl && (
                      <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-sm font-semibold text-brand-800 underline">
                        {m.deliveryUrl}
                      </a>
                    )}
                    {m.qa && m.status !== 'COMPLETED' && (
                      <p className={`mt-1 text-sm font-semibold ${qaFailed ? 'text-red-700' : m.qa.status === 'PASSED' ? 'text-teal-700' : 'text-stone-600'}`}>
                        Kiểm tra tự động: {m.qa.status}
                        {qaFailed && ` (${m.qa.checks.filter((c) => c.status === 'FAILED').map((c) => c.name).join(', ')})`}
                      </p>
                    )}
                    {m.status === 'IN_PROGRESS' && m.note && <p className="mt-1 text-sm font-semibold text-red-700">Khách yêu cầu sửa: {m.note}</p>}
                  </div>
                  <span className="chip-neutral shrink-0">{m.weightPercent}%</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <CoderChat messages={state.chat} onSend={onSendChat} disabled={state.completed} />

      <Sheet
        open={!!handIn && !!cur}
        title={cur ? `Nộp ${cur.id}: ${cur.title}` : 'Nộp mốc'}
        onClose={() => setHandIn(null)}
        footer={
          <>
            <button type="button" onClick={() => setHandIn(null)} className="btn-outline flex-1">Huỷ</button>
            <button
              type="submit"
              form="handin-form"
              disabled={!handIn || (!handIn.url.trim() && !handIn.note.trim()) || urlBad}
              className="btn-primary flex-[2]"
            >
              Gửi khách duyệt
            </button>
          </>
        }
      >
        {handIn && cur && (
          <form
            id="handin-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (urlBad) return;
              onCompleteMilestone(cur.id, { deliveryUrl: handIn.url.trim(), note: handIn.note.trim(), commitHash: gh?.commits[0]?.sha });
              setHandIn(null);
            }}
          >
            <div>
              <label htmlFor="handin-url" className="label">Link bàn giao</label>
              <input
                id="handin-url"
                type="text"
                inputMode="url"
                placeholder="https://…"
                value={handIn.url}
                onChange={(e) => setHandIn({ ...handIn, url: e.target.value })}
                onBlur={() => setUrlTouched(true)}
                aria-invalid={urlBad && urlTouched}
                className="field"
              />
              {urlBad && urlTouched ? (
                <p className="error-text" role="alert">Link phải bắt đầu bằng http:// hoặc https://</p>
              ) : (
                <span className="help">Bản demo, repo GitHub hoặc file Google Drive. Khách mở link này để duyệt.</span>
              )}
            </div>
            <div>
              <label htmlFor="handin-note" className="label">Ghi chú cho khách</label>
              <textarea id="handin-note" rows={4} maxLength={2000} value={handIn.note} onChange={(e) => setHandIn({ ...handIn, note: e.target.value })} className="field" />
              <span className="help text-right tabular-nums">{handIn.note.length}/2000</span>
            </div>
            <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
              {isLast ? 'Tiền mốc cuối vào ví khi khách nghiệm thu cả đơn.' : 'Khách duyệt mốc này thì bạn nhận phần tiền của mốc vào ví.'}
            </p>
          </form>
        )}
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-stone-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-sheet backdrop-blur">
        {state.completed ? (
          <button type="button" onClick={onDismiss} className="btn-primary w-full">Nhận đơn mới</button>
        ) : disputed ? (
          <button type="button" disabled className="btn-primary w-full">Đơn đang tranh chấp</button>
        ) : state.delivered || allDone ? (
          <button type="button" disabled={state.delivered} onClick={onDeliver} className="btn-primary w-full">
            <span className="material-symbols-outlined" aria-hidden>inventory_2</span>
            {state.delivered ? 'Đã nộp — chờ khách nghiệm thu' : 'Nộp bài & bàn giao'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-stone-600">Mốc {nextIdx + 1}/{milestones.length} · {progress}%</p>
              <p className="truncate font-display text-sm font-bold text-stone-900">{cur?.title}</p>
            </div>
            <button type="button" disabled={submitted} onClick={openHandIn} className="btn-primary shrink-0">
              <span className="material-symbols-outlined" aria-hidden>task_alt</span>
              {submitted ? 'Chờ duyệt' : submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Repo provisioning state: pending spinner, invite hint, or error with retry. */
function RepoStatus({ state }: { state: NonNullable<ReturnType<typeof useOrderRepo>> }) {
  const { repo, error, retry } = state;
  if (error || repo?.status === 'FAILED') {
    return (
      <div className="banner-danger" role="alert">
        <span className="min-w-0 flex-1">Không tạo được repo: {repo?.error ?? error}</span>
        <button type="button" onClick={retry} className="btn-outline btn-sm shrink-0">
          Thử lại
        </button>
      </div>
    );
  }
  if (repo?.status !== 'READY') {
    return (
      <p className="flex items-center gap-1 text-sm text-stone-600" role="status">
        <span className="material-symbols-outlined spinner" aria-hidden>progress_activity</span> Đang tạo repo GitHub private…
      </p>
    );
  }
  return (
    <p className="text-sm text-stone-600">
      {repo.collaborator
        ? `Đã mời @${repo.collaborator} quyền push: chấp nhận lời mời trên GitHub trước khi push.`
        : 'Chưa liên kết GitHub: thêm link GitHub trong Hồ sơ để được mời push.'}
    </p>
  );
}
