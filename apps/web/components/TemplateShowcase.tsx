'use client';

import Link from 'next/link';
import { SEED_TEMPLATES } from '@grabcode/contracts';
import { useCurrency } from '../lib/currency';

export default function TemplateShowcase() {
  const { money } = useCurrency();
  return (
    <section id="templates" aria-labelledby="tpl-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="tpl-title" className="font-display text-2xl font-bold text-ink md:text-3xl">Template bàn đạp, có sẵn giá và thời gian</h2>
          <p className="mt-1 text-slate-500">Chọn mẫu gần nhất với ý tưởng, Coder tuỳ biến phần còn lại.</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SEED_TEMPLATES.map((t) => (
          <article key={t.id} className="card card-hover flex flex-col overflow-hidden !p-0">
            <div className="relative aspect-[16/10] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumbnail} alt={`Ảnh minh hoạ ${t.title}`} loading="lazy" className="h-full w-full object-cover" />
              {t.popular && <span className="chip-ok absolute left-3 top-3">Phổ biến</span>}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.category}</span>
              <h3 className="mt-1 font-display text-base font-bold text-ink">{t.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-slate-500">{t.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.techStack.slice(0, 3).map((s) => (
                  <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between pt-4">
                <div>
                  <div className="font-display text-lg font-extrabold text-emerald-dark">{money(t.basePriceVnd)}</div>
                  <div className="text-xs text-slate-500">Giao trong ~{t.etaHours}h</div>
                </div>
                <Link
                  href={`/order/new?tier=TEMPLATE&template=${t.id}&prompt=${encodeURIComponent(t.tagline)}`}
                  className="btn-secondary !px-4 !py-2 !text-sm"
                  aria-label={`Dùng template ${t.title}`}
                >
                  Dùng mẫu
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
