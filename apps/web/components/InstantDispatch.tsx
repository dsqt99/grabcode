'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SAMPLE_PROMPTS, SEED_TEMPLATES, type OrderTier } from '@grabcode/contracts';
import { useCurrency } from '../lib/currency';
import { FRAMEWORKS, TIERS, estimate, getTier } from '../lib/pricing';

export default function InstantDispatch() {
  const router = useRouter();
  const { money } = useCurrency();
  const [tier, setTier] = useState<OrderTier>('EXPRESS');
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [framework, setFramework] = useState(FRAMEWORKS[0]);

  const cfg = getTier(tier);
  const effectiveTemplate = tier === 'TEMPLATE' && !templateId ? SEED_TEMPLATES[0].id : templateId;
  const est = useMemo(() => estimate(tier, prompt, effectiveTemplate), [tier, prompt, effectiveTemplate]);
  const canSubmit = prompt.trim().length >= 10 || tier === 'TEMPLATE';

  const submit = () => {
    const q = new URLSearchParams({ prompt: prompt.trim(), tier, framework });
    if (effectiveTemplate) q.set('template', effectiveTemplate);
    router.push(`/order/new?${q.toString()}`);
  };

  return (
    <section id="dispatch" aria-labelledby="dispatch-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-l3 sm:p-6">
      <h2 id="dispatch-title" className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <span className="material-symbols-outlined text-emerald" aria-hidden>rocket_launch</span>
        Instant Dispatch
      </h2>

      <div role="tablist" aria-label="Chọn tốc độ" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIERS.map((t) => {
          const active = t.id === tier;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTier(t.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.97] ${
                active ? 'border-emerald bg-emerald-mint shadow-l2' : 'border-slate-200 bg-white hover:border-emerald/40'
              }`}
            >
              <span className="flex items-center gap-1 font-display text-sm font-bold text-ink">
                <span className={`material-symbols-outlined !text-[18px] ${active ? 'text-emerald' : 'text-slate-400'}`} aria-hidden>{t.icon}</span>
                {t.label}
              </span>
              <span className="text-xs text-slate-500">{t.id === 'TEMPLATE' ? 'Từ 2 giờ' : `${t.hours} giờ`}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-sm text-slate-500">{cfg.blurb}</p>

      <label htmlFor="idea" className="mb-1 block font-display text-sm font-semibold text-ink">Ý tưởng của bạn</label>
      <textarea
        id="idea"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Mô tả POC bạn cần, ví dụ: Dựng web đặt phòng homestay có thanh toán VietQR..."
        className="w-full resize-none p-3"
      />
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Gợi ý nhanh">
        {SAMPLE_PROMPTS.map((p) => (
          <button key={p} type="button" onClick={() => setPrompt(p)} className="chip bg-slate-100 text-left text-slate-600 transition hover:bg-emerald-mint hover:text-emerald-dark active:scale-95">
            <span className="material-symbols-outlined !text-[14px]" aria-hidden>auto_awesome</span>
            <span className="line-clamp-1 max-w-[16rem]">{p}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tpl" className="mb-1 block font-display text-sm font-semibold text-ink">Template xuất phát</label>
          <select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full p-2.5">
            <option value="">{tier === 'TEMPLATE' ? 'Chọn template...' : 'Không dùng template'}</option>
            {SEED_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fw" className="mb-1 block font-display text-sm font-semibold text-ink">Công nghệ</label>
          <select id="fw" value={framework} onChange={(e) => setFramework(e.target.value)} className="w-full p-2.5">
            {FRAMEWORKS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
        <dl className="flex gap-8">
          <div>
            <dt className="text-xs font-medium text-slate-500">Báo giá tạm tính</dt>
            <dd className="font-display text-2xl font-extrabold text-emerald-dark">{money(est.priceVnd)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Dự kiến giao</dt>
            <dd className="font-display text-2xl font-extrabold text-ink">~{est.etaHours}h</dd>
          </div>
        </dl>
        <button type="button" disabled={!canSubmit} onClick={submit} className="btn-primary w-full sm:w-auto">
          Chuẩn hóa yêu cầu bằng AI
          <span className="material-symbols-outlined !text-[20px]" aria-hidden>arrow_forward</span>
        </button>
      </div>
      {!canSubmit && <p className="mt-2 text-xs text-slate-500">Nhập ít nhất 10 ký tự hoặc chọn một gợi ý để tiếp tục.</p>}
    </section>
  );
}
