'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { estimateOrder, normalizeVnPhone, payoutOf } from '@grabcode/contracts/schemas';
import { eventBus, type AIBrief, type Order, type WaveOffer } from '@grabcode/contracts';
import AIBriefViewer from '../../../components/AIBriefViewer';
import EscrowCheckout from '../../../components/EscrowCheckout';
import Navbar from '../../../components/Navbar';
import { createOrder, ordersApiEnabled, requestBrief } from '../../../lib/api';
import { useAuth } from '@grabcode/auth-ui';
import { genBrief } from '../../../lib/brief';
import { newOrderId, saveOrder } from '../../../lib/orderStore';
import { FRAMEWORKS, daysLabel, getMenuItem, getTemplate } from '../../../lib/pricing';
import { BRAND } from '@grabcode/contracts';


function NewOrder() {
  const router = useRouter();
  const { me } = useAuth();
  const sp = useSearchParams();
  const item = getMenuItem(sp.get('item'));
  const templateId = sp.get('template');
  const framework = sp.get('framework') ?? FRAMEWORKS[0];
  const initialPrompt = sp.get('prompt') ?? '';

  const [prompt, setPrompt] = useState(initialPrompt);
  const [brief, setBrief] = useState<AIBrief | null>(null);
  /** Prompt the shown brief was made from: editing the prompt afterwards locks the order until it is analyzed again. */
  const [analyzedPrompt, setAnalyzedPrompt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [briefFailed, setBriefFailed] = useState(false);
  const [run, setRun] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P0-5: asked once, while the profile has no valid Vietnamese mobile. P0-9: terms ticked before every order.
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const needPhone = ordersApiEnabled && !(me?.phone && normalizeVnPhone(me.phone));
  const validPhone = normalizeVnPhone(phone);

  useEffect(() => {
    if (!prompt.trim()) {
      setAnalyzing(false);
      setBrief(null);
      return;
    }
    setAnalyzing(true);
    setBriefFailed(false);
    const asked = prompt;
    const ctrl = new AbortController();
    requestBrief({ prompt: asked, templateId, framework }, ctrl.signal)
      // No API configured (local demo): simulated 2s analysis with the template brief.
      .then((b) => b ?? new Promise<AIBrief>((r) => setTimeout(() => r(genBrief(asked, item.code, templateId, framework)), 2000)))
      .then(
        (b) => {
          if (ctrl.signal.aborted) return;
          setBrief(b);
          setAnalyzedPrompt(asked);
          setAnalyzing(false);
        },
        (err) => {
          if (ctrl.signal.aborted) return; // a newer run took over
          // P0-11: never swap in a sample brief silently; the customer would pay for a spec nobody wrote for them.
          console.warn('AI brief failed:', err);
          setBrief(null);
          setBriefFailed(true);
          setAnalyzing(false);
        },
      );
    return () => ctrl.abort();
    // Re-run only when the user requests a new analysis (run) or inputs from URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, item.code, templateId, framework]);

  const tpl = getTemplate(templateId);
  // "Giá từ" of the item: the server creates the order with it and an admin quotes the final price before payment.
  const est = estimateOrder(item.code);

  const stale = !!brief && analyzedPrompt !== null && prompt.trim() !== analyzedPrompt.trim();
  const blocker = !brief || analyzing
    ? null
    : stale
      ? 'Bạn đã sửa yêu cầu — bấm "Phân tích lại" để cập nhật đặc tả.'
      : needPhone && !validPhone
        ? `Nhập số điện thoại để ${BRAND.name} liên hệ về đơn.`
        : !agreed
          ? 'Tích đồng ý điều khoản để tạo đơn.'
          : null;

  const dispatch = async () => {
    if (!brief || stale) return;
    setSubmitting(true);
    if (ordersApiEnabled) {
      // DRAFT at the item's "giá từ"; the order page shows the transfer QR once an admin quoted the price.
      setError(null);
      try {
        const created = await createOrder({ prompt, menuItem: item.code, templateId, framework, brief, acceptTerms: true, ...(needPhone && validPhone ? { phone: validPhone } : {}) });
        router.push(`/order/${created.id}`);
      } catch (e) {
        console.error(e);
        setError((e as { status?: number }).status === 400 ? 'Thông tin chưa hợp lệ, kiểm tra số điện thoại rồi thử lại.' : 'Không tạo được đơn. Vui lòng thử lại.');
        setSubmitting(false);
      }
      return;
    }
    const id = newOrderId();
    const now = new Date().toISOString();
    const order: Order = {
      id,
      tier: 'STANDARD',
      title: brief.title.replace(/^Đặc tả kỹ thuật:\s*/, ''),
      customerName: me?.name ?? 'Khách hàng',
      customerPrompt: prompt,
      templateId: tpl?.id,
      templateName: tpl?.title,
      framework,
      priceVnd: est.priceVnd,
      escrowStatus: 'ESCROW_LOCKED',
      status: 'DISPATCHING',
      brief,
      createdAt: now,
      etaHours: est.etaHours,
      commits: [],
    };
    const offer: WaveOffer = {
      id: `offer-${id}`,
      orderId: id,
      title: order.title,
      tier: 'STANDARD',
      customerName: order.customerName,
      netPayoutVnd: payoutOf(est.priceVnd),
      deadlineHours: est.etaHours,
      summary: brief.scopeSummary,
      expiresInSeconds: 30,
      createdAt: now,
      templateName: tpl?.title,
    };
    saveOrder(order);
    eventBus.publish({ type: 'ORDER_DISPATCHED', payload: { order, offer }, timestamp: now });
    router.push(`/order/${id}`);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <OrderSteps />
        <div className="mb-6 mt-4">
          <h1 className="font-display text-2xl font-extrabold text-stone-900 md:text-3xl">Xác nhận đặc tả & đặt đơn</h1>
          <span className="chip-progress mt-2">{item.name} · {daysLabel(item.days)}</span>
          {error && (
            <p role="alert" className="banner-danger mt-3">
              <span className="material-symbols-outlined !text-[20px]" aria-hidden>error</span>
              {error}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
          <div className="min-w-0 space-y-4 md:space-y-6">
            <div className="card space-y-3">
              <label htmlFor="prompt" className="label">Yêu cầu của bạn</label>
              <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="field resize-none" placeholder="Mô tả app bạn cần..." />
              {stale && (
                <p className="banner-warn" role="status">
                  <span className="material-symbols-outlined !text-[20px]" aria-hidden>info</span>
                  Bạn đã sửa yêu cầu — bấm Phân tích lại để cập nhật đặc tả.
                </p>
              )}
              <button type="button" onClick={() => setRun((n) => n + 1)} disabled={analyzing || !prompt.trim()} className="btn-outline btn-sm">
                <span className="material-symbols-outlined !text-[20px]" aria-hidden>refresh</span>
                Phân tích lại
              </button>
            </div>
            {briefFailed ? (
              <div className="banner-danger" role="alert">
                <span className="material-symbols-outlined" aria-hidden>error</span>
                <div className="space-y-2">
                  <p className="font-display text-base font-bold">AI chưa soạn được đặc tả</p>
                  <p>Dịch vụ AI tạm thời không phản hồi. Bạn thử lại sau ít phút nhé.</p>
                  <button type="button" className="btn-primary btn-sm" onClick={() => setRun((n) => n + 1)}>Thử lại</button>
                </div>
              </div>
            ) : (
              <AIBriefViewer brief={brief} analyzing={analyzing} />
            )}
          </div>
          <EscrowCheckout
            itemName={item.name}
            fromPriceVnd={item.fromPriceVnd}
            days={item.days}
            disabled={!brief || analyzing || !!blocker}
            hint={blocker}
            submitting={submitting}
            onConfirm={dispatch}
          >
            {needPhone && (
              <div>
                <label htmlFor="phone" className="label">Số điện thoại (Zalo)</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  aria-invalid={!!phone && !validPhone}
                  aria-describedby="phone-help"
                  className="field"
                />
                {phone && !validPhone ? (
                  <span id="phone-help" className="error-text">Số di động Việt Nam chưa hợp lệ (10 số, bắt đầu 03/05/07/08/09).</span>
                ) : (
                  <span id="phone-help" className="help">{BRAND.name} gọi / nhắn Zalo khi cần xác nhận đơn. Lưu vào hồ sơ của bạn.</span>
                )}
              </div>
            )}
            <label className="check-row text-sm text-stone-700">
              <input type="checkbox" className="check" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                Tôi đồng ý{' '}
                <Link href="/dieu-khoan" target="_blank" className="font-semibold text-brand-800 underline">Điều khoản sử dụng</Link> và{' '}
                <Link href="/chinh-sach-hoan-tien" target="_blank" className="font-semibold text-brand-800 underline">Chính sách hoàn tiền</Link>.
              </span>
            </label>
          </EscrowCheckout>
        </div>
      </main>
    </>
  );
}

const ORDER_STEPS = ['Mô tả', 'Xem đặc tả', `${BRAND.name} báo giá`, 'Chuyển khoản'];
const CURRENT_STEP = 1;

/** Static order-flow steps: where the money step comes (redesign-web-home §2). */
function OrderSteps() {
  return (
    <nav aria-label="Các bước đặt đơn">
      <p className="text-sm font-semibold text-stone-900 md:hidden">Bước {CURRENT_STEP + 1}/{ORDER_STEPS.length} · Xem đặc tả & tạo đơn</p>
      <div className="mt-2 grid grid-cols-4 gap-1 md:hidden" aria-hidden>
        {ORDER_STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 rounded-full ${i <= CURRENT_STEP ? 'bg-brand-600' : 'bg-stone-200'}`} />
        ))}
      </div>
      <ol className="hidden items-center gap-2 text-sm md:flex">
        {ORDER_STEPS.map((s, i) => (
          <li key={s} aria-current={i === CURRENT_STEP ? 'step' : undefined} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full font-display text-xs font-bold ${
                i < CURRENT_STEP ? 'bg-teal-600 text-white' : i === CURRENT_STEP ? 'bg-brand-700 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {i < CURRENT_STEP ? <span className="material-symbols-outlined !text-[16px]" aria-label="Xong">check</span> : i + 1}
            </span>
            <span className={i === CURRENT_STEP ? 'font-semibold text-stone-900' : 'text-stone-600'}>{s}</span>
            {i < ORDER_STEPS.length - 1 && <span className="h-px w-8 bg-stone-300" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:px-8 lg:grid-cols-[1fr_400px]" aria-busy="true">
          <span className="sr-only">Đang tải…</span>
          <div className="skeleton h-80" />
          <div className="skeleton h-64" />
        </div>
      }
    >
      <NewOrder />
    </Suspense>
  );
}
