'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SAMPLE_PROMPTS, SEED_TEMPLATES } from '@grabcode/contracts';
import { useCurrency } from '../lib/currency';
import { MAX_ORDER_VND } from '@grabcode/contracts/schemas';
import { FRAMEWORKS, MENU, daysLabel, getMenuItem, type MenuItemCode } from '../lib/pricing';
import { BRAND } from '@grabcode/contracts';


const MIN_PROMPT = 10;

/** Home order box: pick a menu item (giá từ + days), describe the job; Ai Code AI quotes the final price before payment. */
export default function InstantDispatch() {
  const router = useRouter();
  const { money } = useCurrency();
  const [code, setCode] = useState<MenuItemCode>(MENU[0].code);
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [framework, setFramework] = useState(FRAMEWORKS[0]);

  const item = getMenuItem(code);
  const length = prompt.trim().length;
  const canSubmit = length >= MIN_PROMPT;

  // A sample question belongs to exactly one demo pack (HON-60): picking it also selects that pack.
  const pickSample = (question: string) => {
    setPrompt(question);
    const m = MENU.find((x) => x.sampleQuestion === question);
    if (m) setCode(m.code);
  };

  const submit = () => {
    const q = new URLSearchParams({ prompt: prompt.trim(), item: code, framework });
    if (templateId) q.set('template', templateId);
    router.push(`/order/new?${q.toString()}`);
  };

  return (
    <section id="dispatch" aria-labelledby="dispatch-title" className="card-raised scroll-mt-20 space-y-4">
      <h2 id="dispatch-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900 md:text-xl">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>edit_note</span>
        Bạn cần làm gì?
      </h2>

      <div>
        <label htmlFor="item" className="label">Gói demo</label>
        <select id="item" value={code} onChange={(e) => setCode(e.target.value as MenuItemCode)} className="field">
          {MENU.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name} · {money(m.fromPriceVnd)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-600">Bản chạy thử (demo/POC) giao trong 2–3 ngày, mỗi đơn tối đa {money(MAX_ORDER_VND)}. Sản phẩm đầy đủ nằm ngoài phạm vi.</p>
        <div className="mt-2 rounded-xl bg-stone-50 p-3" aria-live="polite">
          <p className="text-sm text-stone-700">{item.scope}</p>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-stone-600">Giá gói</dt>
              <dd className="font-display font-bold tabular-nums text-brand-800">{money(item.fromPriceVnd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-600">Thời gian</dt>
              <dd className="font-display font-bold text-stone-900">{daysLabel(item.days)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="idea" className="label">Mô tả việc cần làm</label>
          {length < MIN_PROMPT && <span className="text-xs text-stone-600">{length}/{MIN_PROMPT} ký tự tối thiểu</span>}
        </div>
        <textarea
          id="idea"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ví dụ: Mình bán son handmade, cần 1 trang có nút đặt qua Zalo..."
          className="field resize-none"
        />
        <div className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Gợi ý nhanh">
          {SAMPLE_PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => pickSample(p)} className="chip-neutral min-h-[44px] shrink-0 snap-start px-3 text-left hover:bg-brand-50 hover:text-brand-800">
              <span className="material-symbols-outlined text-[16px]!" aria-hidden>auto_awesome</span>
              <span className="line-clamp-2 max-w-[18rem]">{p}</span>
            </button>
          ))}
        </div>
      </div>

      <details className="group rounded-xl border border-stone-200">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 font-display text-sm font-semibold text-stone-900">
          Tuỳ chọn kỹ thuật (không bắt buộc)
          <span className="material-symbols-outlined text-stone-600 transition group-open:rotate-180" aria-hidden>expand_more</span>
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl" className="label">Template xuất phát</label>
            <select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="field">
              <option value="">Không dùng template</option>
              {SEED_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fw" className="label">Công nghệ</label>
            <select id="fw" value={framework} onChange={(e) => setFramework(e.target.value)} className="field">
              {FRAMEWORKS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div>
        <button type="button" disabled={!canSubmit} onClick={submit} className="btn-primary w-full" aria-describedby="dispatch-help">
          Xem đặc tả & báo giá
          <span className="material-symbols-outlined text-[20px]!" aria-hidden>arrow_forward</span>
        </button>
        <p id="dispatch-help" className={`mt-2 text-sm ${canSubmit ? 'text-stone-600' : 'font-semibold text-amber-800'}`}>
          {canSubmit
            ? `Bạn chưa phải trả tiền ở bước này. ${BRAND.name} báo giá chốt trước khi bạn chuyển khoản.`
            : 'Nhập ít nhất 10 ký tự hoặc chọn một gợi ý để tiếp tục.'}
        </p>
      </div>
    </section>
  );
}
