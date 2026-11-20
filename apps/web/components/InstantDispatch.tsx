'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SAMPLE_PROMPTS, SEED_TEMPLATES } from '@grabcode/contracts';
import { useCurrency } from '../lib/currency';
import { FRAMEWORKS, MENU, daysLabel, getMenuItem, type MenuItemCode } from '../lib/pricing';
import { BRAND } from '@grabcode/contracts';


/** Home order box: pick a menu item (giá từ + days), describe the job; FastDemo quotes the final price before payment. */
export default function InstantDispatch() {
  const router = useRouter();
  const { money } = useCurrency();
  const [code, setCode] = useState<MenuItemCode>(MENU[0].code);
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [framework, setFramework] = useState(FRAMEWORKS[0]);

  const item = getMenuItem(code);
  const canSubmit = prompt.trim().length >= 10;

  const submit = () => {
    const q = new URLSearchParams({ prompt: prompt.trim(), item: code, framework });
    if (templateId) q.set('template', templateId);
    router.push(`/order/new?${q.toString()}`);
  };

  return (
    <section id="dispatch" aria-labelledby="dispatch-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-l3 sm:p-6">
      <h2 id="dispatch-title" className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <span className="material-symbols-outlined text-emerald" aria-hidden>rocket_launch</span>
        Bạn cần làm gì?
      </h2>

      <label htmlFor="item" className="mb-1 block font-display text-sm font-semibold text-ink">Loại việc</label>
      <select id="item" value={code} onChange={(e) => setCode(e.target.value as MenuItemCode)} className="w-full p-2.5 !text-base">
        {MENU.map((m) => (
          <option key={m.code} value={m.code}>
            {m.name} · từ {money(m.fromPriceVnd)}
          </option>
        ))}
      </select>
      <p className="mb-4 mt-2 text-sm text-slate-500">{item.scope}</p>

      <label htmlFor="idea" className="mb-1 block font-display text-sm font-semibold text-ink">Mô tả việc cần làm</label>
      <textarea
        id="idea"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ví dụ: Dựng web đặt phòng homestay có thanh toán VietQR..."
        className="w-full resize-none p-3 !text-base"
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
            <option value="">Không dùng template</option>
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
            <dt className="text-xs font-medium text-slate-500">Giá từ</dt>
            <dd className="font-display text-2xl font-extrabold text-emerald-dark">{money(item.fromPriceVnd)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Thời gian</dt>
            <dd className="font-display text-lg font-extrabold text-ink">{daysLabel(item.days)}</dd>
          </div>
        </dl>
        <button type="button" disabled={!canSubmit} onClick={submit} className="btn-primary w-full sm:w-auto">
          Xem đặc tả & báo giá
          <span className="material-symbols-outlined !text-[20px]" aria-hidden>arrow_forward</span>
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {canSubmit ? `${BRAND.name} báo giá chốt cho đơn của bạn trước khi bạn chuyển khoản.` : 'Nhập ít nhất 10 ký tự hoặc chọn một gợi ý để tiếp tục.'}
      </p>
    </section>
  );
}
