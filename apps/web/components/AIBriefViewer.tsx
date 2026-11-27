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
        <li key={t} className="flex gap-2 text-sm text-stone-700">
          <span className={`material-symbols-outlined text-[20px]! ${tone}`} aria-hidden>{icon}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function GroupTitle({ children }: { children: string }) {
  return <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-stone-600">{children}</h3>;
}

export default function AIBriefViewer({ brief, analyzing }: Props) {
  const [tab, setTab] = useState<'spec' | 'claude'>('spec');

  if (analyzing || !brief) {
    // Skeleton shaped like the brief; no fake progress bar (it never matched the real analysis time).
    return (
      <div className="card space-y-4" aria-busy="true">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="material-symbols-outlined text-brand-600" aria-hidden>auto_awesome</span>
          AI đang soạn đặc tả từ yêu cầu của bạn…
        </p>
        <div className="skeleton h-6 w-3/5" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="skeleton h-4 w-4/5" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0!">
      <div className="border-b border-stone-200 p-4 md:p-6">
        <span className="chip-success mb-2"><span className="material-symbols-outlined text-[16px]!" aria-hidden>verified</span>Đặc tả đã soạn</span>
        <h2 className="font-display text-lg font-bold text-stone-900 md:text-xl">{brief.title}</h2>
        <p className="mt-1 text-sm text-stone-600">{brief.scopeSummary}</p>
      </div>

      <div role="tablist" aria-label="Chế độ xem" className="flex gap-1 overflow-x-auto border-b border-stone-200 px-4 md:px-6">
        {([['spec', 'Đặc tả'], ['claude', 'Hướng dẫn cho freelancer (CLAUDE.md)']] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px min-h-[44px] shrink-0 border-b-2 px-3 font-display text-sm font-semibold transition ${
              tab === k ? 'border-brand-700 text-brand-800' : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'claude' ? (
        <pre className="m-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-stone-200 md:m-6">{brief.claudeMdContent}</pre>
      ) : (
        <div className="space-y-6 p-4 md:p-6">
          <section aria-label="Tính năng chính">
            <GroupTitle>Mục tiêu cốt lõi</GroupTitle>
            <List items={brief.features} icon="check_circle" tone="text-teal-700" />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label="Trong phạm vi">
              <GroupTitle>Trong phạm vi</GroupTitle>
              <List items={brief.inScope} icon="add_circle" tone="text-teal-700" />
            </section>
            <section aria-label="Ngoài phạm vi">
              <GroupTitle>Ngoài phạm vi</GroupTitle>
              <List items={brief.outOfScope} icon="do_not_disturb_on" tone="text-stone-500" />
            </section>
          </div>

          <section aria-label="Mốc thanh toán">
            <GroupTitle>{`${brief.milestones.length} mốc bàn giao`}</GroupTitle>
            <ol className="grid gap-3 md:grid-cols-3">
              {brief.milestones.map((m) => (
                <li key={m.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="chip-dark">{m.id}</span>
                    <span className="font-display text-lg font-extrabold tabular-nums text-brand-800">{m.weightPercent}%</span>
                  </div>
                  <p className="mt-2 font-display text-sm font-bold text-stone-900">{m.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{m.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Tiêu chí nghiệm thu">
            <GroupTitle>Tiêu chí nghiệm thu</GroupTitle>
            <List items={brief.acceptanceCriteria.map((c) => c.text)} icon="check_box_outline_blank" tone="text-stone-500" />
          </section>
        </div>
      )}
    </div>
  );
}
