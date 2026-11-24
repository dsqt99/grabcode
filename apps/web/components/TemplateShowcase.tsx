'use client';

import Link from 'next/link';
import { SEED_TEMPLATES } from '@grabcode/contracts';
import { useCurrency } from '../lib/currency';
import { daysLabel, getMenuItem } from '../lib/pricing';

/** Drawn tile instead of the hotlinked `thumbnail` photos (outside hosts, one showed a copyrighted character). */
const CATEGORY_ICON: [RegExp, string][] = [
  [/crm/i, 'contacts'],
  [/fintech|saas/i, 'monitoring'],
  [/e-?commerce/i, 'storefront'],
  [/\bai\b/i, 'smart_toy'],
];
const categoryIcon = (category: string) => CATEGORY_ICON.find(([re]) => re.test(category))?.[1] ?? 'web';

export default function TemplateShowcase() {
  const { money } = useCurrency();
  return (
    <section id="templates" aria-labelledby="tpl-title" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 md:px-8 md:py-16">
      <h2 id="tpl-title" className="font-display text-2xl font-extrabold text-stone-900 md:text-3xl">Mẫu có sẵn, có giá từ và thời gian dự kiến</h2>
      <p className="mt-1 text-stone-600">Chọn mẫu gần nhất với ý tưởng, freelancer tuỳ biến phần còn lại.</p>
      <ul className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
        {SEED_TEMPLATES.map((t) => ({ t, item: getMenuItem(t.menuItem) })).map(({ t, item }) => (
          <li key={t.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-auto">
            <article className="card card-hover flex h-full flex-col overflow-hidden !p-0">
              <div className="grid aspect-[16/9] place-items-center rounded-t-2xl bg-gradient-to-br from-brand-50 to-stone-100" aria-hidden>
                <span className="material-symbols-outlined !text-[48px] text-brand-700">{categoryIcon(t.category)}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">{t.category}</span>
                <h3 className="mt-1 font-display text-base font-bold text-stone-900">{t.title}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-stone-600">{t.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {t.techStack.slice(0, 3).map((s) => (
                    <span key={s} className="chip-neutral">{s}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <div>
                    <div className="font-display font-bold tabular-nums text-brand-800">từ {money(item.fromPriceVnd)}</div>
                    <div className="text-xs text-stone-600">{daysLabel(item.days)}</div>
                  </div>
                  <Link
                    href={`/order/new?item=${item.code}&template=${t.id}&prompt=${encodeURIComponent(t.tagline)}`}
                    className="btn-secondary btn-sm"
                    aria-label={`Dùng template ${t.title}`}
                  >
                    Dùng mẫu
                  </Link>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
