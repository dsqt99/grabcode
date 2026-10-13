'use client';

import { useState } from 'react';
import type { CoderState } from '../lib/coderStore';
import { formatVnd, getMilestones, repoUrlOf } from '../lib/coderStore';
import CoderChat from './CoderChat';

export default function ActiveJobWorkspace({
  state,
  onCompleteMilestone,
  onDeliver,
  onSendChat,
  onDismiss,
}: {
  state: CoderState;
  onCompleteMilestone: (id: string) => void;
  onDeliver: () => void;
  onSendChat: (text: string) => void;
  onDismiss: () => void;
}) {
  const order = state.activeOrder;
  const [copied, setCopied] = useState(false);
  if (!order) return null;

  const milestones = getMilestones(order);
  const done = state.completedMilestones;
  const nextIdx = milestones.findIndex((m) => !done.includes(m.id));
  const allDone = nextIdx === -1;
  const progress = milestones.reduce((sum, m) => sum + (done.includes(m.id) ? m.weightPercent : 0), 0);
  const repo = repoUrlOf(order);
  const cloneCmd = `git clone ${repo}.git`;

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
    <div className="flex flex-col gap-4">
      <section className="card card-hover shadow-l2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={state.completed ? 'chip-ok' : state.delivered ? 'chip-warn' : 'chip-dark'}>
              {state.completed ? 'Đã hoàn tất' : state.delivered ? 'Chờ nghiệm thu' : 'Đang thực hiện'} · {order.id}
            </span>
            <h2 className="mt-2 font-display text-lg font-extrabold leading-tight text-ink">{order.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{order.customerName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Thu nhập</p>
            <p className="font-display text-base font-extrabold text-emerald-dark">{formatVnd(state.activePayoutVnd)}</p>
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
        <button type="button" onClick={downloadClaudeMd} className="btn-secondary mt-3 min-h-[48px] w-full">
          <span className="material-symbols-outlined">download</span> Tải CLAUDE.md
        </button>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-inverse-primary">{cloneCmd}</code>
          <button type="button" onClick={copyClone} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white active:scale-95">
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </div>
        <a href={repo} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-dark">
          <span className="material-symbols-outlined !text-[18px]">link</span> Mở repo GitHub
        </a>
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
                  </div>
                  <span className="chip-warn shrink-0">{m.weightPercent}%</span>
                </div>
                {isCurrent && (
                  <button type="button" onClick={() => onCompleteMilestone(m.id)} className="btn-primary mt-3 min-h-[48px] w-full">
                    <span className="material-symbols-outlined">task_alt</span> Xong mốc [{m.id}]
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {state.completed ? (
          <button type="button" onClick={onDismiss} className="btn-primary mt-4 min-h-[52px] w-full">
            Nhận cuốc mới
          </button>
        ) : (
          <button type="button" disabled={!allDone || state.delivered} onClick={onDeliver} className="btn-primary mt-4 min-h-[52px] w-full">
            <span className="material-symbols-outlined">rocket_launch</span>
            {state.delivered ? 'Đã nộp — chờ khách nghiệm thu' : 'Nộp bài & Bàn giao POC'}
          </button>
        )}
      </section>

      <CoderChat messages={state.chat} onSend={onSendChat} disabled={state.completed} />
    </div>
  );
}
