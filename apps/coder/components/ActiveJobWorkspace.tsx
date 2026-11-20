'use client';

import { useState } from 'react';
import type { CoderState, HandIn } from '../lib/coderStore';
import { formatVnd, getMilestones, repoUrlOf } from '../lib/coderStore';
import { useOrderRepo } from '../lib/repo';
import CoderChat from './CoderChat';

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
  const real = useOrderRepo(order);
  if (!order) return null;

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

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="card card-hover shadow-l2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={state.completed ? 'chip-ok' : state.delivered ? 'chip-warn' : 'chip-dark'}>
              {state.completed ? 'Đã hoàn tất' : state.delivered ? 'Chờ nghiệm thu' : 'Đang thực hiện'} · {order.id}
            </span>
            <h2 className="mt-2 font-display text-lg font-extrabold leading-tight text-ink">{order.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{order.customerName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-500">Thu nhập</p>
            <p className="whitespace-nowrap font-display text-base font-extrabold text-emerald-dark">{formatVnd(state.activePayoutVnd)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{order.brief.scopeSummary}</p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>Tiến độ</span>
            <span className="text-emerald-dark">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="font-display text-sm font-bold">Môi trường làm việc</h3>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-inverse-primary">{cloneCmd}</code>
          <button type="button" onClick={copyClone} disabled={!ready} className="shrink-0 disabled:opacity-40 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white active:scale-95">
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </div>
        {real && <RepoStatus state={real} />}
        <div className="mt-2 flex flex-wrap gap-2">
          {ready && (
            <a href={repo} target="_blank" rel="noreferrer" className="btn-ghost min-h-[44px] border border-slate-200 !px-3 text-emerald-dark">
              <span className="material-symbols-outlined !text-[18px]" aria-hidden>link</span> Mở repo
            </a>
          )}
          <button type="button" onClick={downloadClaudeMd} className="btn-ghost min-h-[44px] border border-slate-200 !px-3">
            <span className="material-symbols-outlined !text-[18px]" aria-hidden>download</span> CLAUDE.md
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="font-display text-sm font-bold">Mốc bàn giao</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {milestones.map((m, i) => {
            const isDone = done.includes(m.id);
            const isCurrent = i === nextIdx && !state.delivered;
            return (
              <li
                key={m.id}
                className={`rounded-lg border p-3 transition ${
                  isDone ? 'border-emerald/30 bg-emerald-mint' : isCurrent ? 'border-emerald bg-white shadow-l2' : 'border-slate-200 bg-slate-50 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                      isDone ? 'bg-emerald text-white' : isCurrent ? 'bg-ink text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isDone ? <span className="material-symbols-outlined !text-[18px]">check</span> : m.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{m.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                    {m.status === 'SUBMITTED' && <p className="mt-1 text-xs font-semibold text-amber-700">Đã nộp{m.commitHash ? ` @${m.commitHash.slice(0, 7)}` : ''} — chờ khách duyệt</p>}
                    {m.deliveryUrl && (
                      <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs font-semibold text-emerald-dark underline">
                        {m.deliveryUrl}
                      </a>
                    )}
                    {m.qa && m.status !== 'COMPLETED' && (
                      <p className={`mt-1 text-xs font-semibold ${m.qa.status === 'FAILED' ? 'text-red-600' : m.qa.status === 'PASSED' ? 'text-emerald-dark' : 'text-slate-500'}`}>
                        QA Gate: {m.qa.status}
                        {m.qa.status === 'FAILED' && ` (${m.qa.checks.filter((c) => c.status === 'FAILED').map((c) => c.name).join(', ')})`}
                      </p>
                    )}
                    {m.qa?.status === 'FAILED' && m.status !== 'COMPLETED' &&
                      m.qa.checks.filter((c) => c.status === 'FAILED').map((c) => (
                        <pre key={c.name} className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600">{c.detail}</pre>
                      ))}
                    {m.status === 'IN_PROGRESS' && m.note && <p className="mt-1 text-xs font-semibold text-red-600">Khách yêu cầu sửa: {m.note}</p>}
                  </div>
                  <span className="chip-warn shrink-0">{m.weightPercent}%</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <CoderChat messages={state.chat} onSend={onSendChat} disabled={state.completed} />

      {handIn && !allDone && (
        <form
          className="card fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md flex-col gap-3 shadow-l3"
          onSubmit={(e) => {
            e.preventDefault();
            onCompleteMilestone(milestones[nextIdx].id, { deliveryUrl: handIn.url.trim(), note: handIn.note.trim(), commitHash: gh?.commits[0]?.sha });
            setHandIn(null);
          }}
        >
          <h3 className="font-display text-sm font-bold">Bàn giao {milestones[nextIdx].id}: {milestones[nextIdx].title}</h3>
          <label className="text-xs font-semibold text-slate-600">
            Link bàn giao (demo, repo GitHub, file Google Drive...)
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              pattern="https?://.+"
              value={handIn.url}
              onChange={(e) => setHandIn({ ...handIn, url: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Ghi chú cho khách
            <textarea
              rows={3}
              maxLength={2000}
              value={handIn.note}
              onChange={(e) => setHandIn({ ...handIn, note: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setHandIn(null)} className="btn-secondary min-h-[44px] flex-1">
              Huỷ
            </button>
            <button type="submit" disabled={!handIn.url.trim() && !handIn.note.trim()} className="btn-primary min-h-[44px] flex-1">
              Gửi khách duyệt
            </button>
          </div>
        </form>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-l3 backdrop-blur">
        {state.completed ? (
          <button type="button" onClick={onDismiss} className="btn-primary min-h-[52px] w-full">
            Nhận cuốc mới
          </button>
        ) : state.delivered || allDone ? (
          <button type="button" disabled={state.delivered} onClick={onDeliver} className="btn-primary min-h-[52px] w-full">
            <span className="material-symbols-outlined" aria-hidden>rocket_launch</span>
            {state.delivered ? 'Đã nộp — chờ khách nghiệm thu' : 'Nộp bài & Bàn giao POC'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">
                Mốc {nextIdx + 1}/{milestones.length} · tiến độ {progress}%
              </p>
              <p className="truncate font-display text-sm font-bold text-ink">{milestones[nextIdx].title}</p>
            </div>
            <button
              type="button"
              disabled={milestones[nextIdx].status === 'SUBMITTED'}
              onClick={() => (real ? setHandIn({ url: '', note: '' }) : onCompleteMilestone(milestones[nextIdx].id))}
              className="btn-primary min-h-[52px] shrink-0 !px-5"
            >
              <span className="material-symbols-outlined" aria-hidden>task_alt</span>
              {milestones[nextIdx].status === 'SUBMITTED' ? 'Chờ duyệt' : real ? `Nộp ${milestones[nextIdx].id}` : `Xong ${milestones[nextIdx].id}`}
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
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">
        <span className="min-w-0 flex-1">Không tạo được repo: {repo?.error ?? error}</span>
        <button type="button" onClick={retry} className="shrink-0 rounded-full bg-white px-3 py-1.5 font-semibold text-red-700">
          Thử lại
        </button>
      </div>
    );
  }
  if (repo?.status !== 'READY') {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500" role="status">
        <span className="material-symbols-outlined animate-spin !text-[16px]" aria-hidden>progress_activity</span> Đang tạo repo GitHub private…
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-slate-500">
      {repo.collaborator
        ? `Đã mời @${repo.collaborator} quyền push: chấp nhận lời mời trên GitHub trước khi push.`
        : 'Chưa liên kết GitHub: thêm link GitHub trong Hồ sơ để được mời push.'}
    </p>
  );
}
