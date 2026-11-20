'use client';

import { useState } from 'react';
import type { AIBrief } from '@grabcode/contracts';

interface Props {
  brief: AIBrief | null;
  analyzing: boolean;
}

function List({ items, icon, tone }: { items: string[]; icon: string; tone: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm text-slate-700">
          <span className={`material-symbols-outlined !text-[18px] ${tone}`} aria-hidden>{icon}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function AIBriefViewer({ brief, analyzing }: Props) {
  const [tab, setTab] = useState<'spec' | 'claude'>('spec');

  if (analyzing || !brief) {
    return (
      <div className="card flex flex-col items-center gap-4 py-16 text-center shadow-l2" role="status" aria-live="polite">
        <div className="relative grid h-16 w-16 place-items-center">
          <span className="absolute h-16 w-16 animate-sonar rounded-full bg-emerald/40" />
          <span className="material-symbols-outlined relative text-4xl text-emerald" aria-hidden>auto_awesome</span>
        </div>
        <p className="font-display text-lg font-bold text-ink">AI đang soạn đặc tả từ yêu cầu của bạn...</p>
        <p className="text-sm text-slate-500">Phân tích phạm vi, chia mốc bàn giao và soạn hướng dẫn cho freelancer</p>
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-full origin-left rounded-full bg-emerald" style={{ animation: 'grow 2s linear forwards' }} />
        </div>
        <style>{'@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
      </div>
    );
  }

  return (
    <div className="card !p-0 shadow-l2 animate-pop">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <span className="chip-ok mb-2"><span className="material-symbols-outlined !text-[14px]" aria-hidden>verified</span>Đặc tả đã soạn</span>
          <h2 className="font-display text-xl font-bold text-ink">{brief.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{brief.scopeSummary}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Chế độ xem" className="flex gap-1 border-b border-slate-100 px-5 pt-3">
        {([['spec', 'Đặc tả'], ['claude', 'CLAUDE.md']] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 font-display text-sm font-semibold transition ${
              tab === k ? 'border-emerald text-emerald-dark' : 'border-transparent text-slate-500 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'claude' ? (
        <pre className="m-5 overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-slate-200">{brief.claudeMdContent}</pre>
      ) : (
        <div className="space-y-6 p-5">
          <section aria-label="Tính năng chính">
            <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-slate-400">Mục tiêu cốt lõi</h3>
            <List items={brief.features} icon="check_circle" tone="text-emerald" />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label="Trong phạm vi">
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-slate-400">Trong phạm vi</h3>
              <List items={brief.inScope} icon="add_circle" tone="text-emerald" />
            </section>
            <section aria-label="Ngoài phạm vi">
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-slate-400">Ngoài phạm vi</h3>
              <List items={brief.outOfScope} icon="do_not_disturb_on" tone="text-slate-400" />
            </section>
          </div>

          <section aria-label="Mốc thanh toán">
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-slate-400">3 mốc bàn giao</h3>
            <ol className="grid gap-3 md:grid-cols-3">
              {brief.milestones.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="chip-dark">{m.id}</span>
                    <span className="font-display text-lg font-extrabold text-emerald-dark">{m.weightPercent}%</span>
                  </div>
                  <p className="mt-2 font-display text-sm font-bold text-ink">{m.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{m.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Tiêu chí nghiệm thu">
            <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-slate-400">Tiêu chí nghiệm thu</h3>
            <ul className="space-y-2">
              {brief.acceptanceCriteria.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm text-slate-700">
                  <span className="material-symbols-outlined !text-[18px] text-slate-300" aria-hidden>check_box_outline_blank</span>
                  {c.text}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
