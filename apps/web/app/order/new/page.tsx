'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { normalizeVnPhone, payoutOf } from '@grabcode/contracts/schemas';
import { eventBus, type AIBrief, type Order, type WaveOffer } from '@grabcode/contracts';
import AIBriefViewer from '../../../components/AIBriefViewer';
import EscrowCheckout from '../../../components/EscrowCheckout';
import Navbar from '../../../components/Navbar';
import { createOrder, ordersApiEnabled, requestBrief } from '../../../lib/api';
import { useAuth } from '@grabcode/auth-ui';
import { genBrief } from '../../../lib/brief';
import { newOrderId, saveOrder } from '../../../lib/orderStore';
import { FRAMEWORKS, estimate, getTemplate, getTier, isTier } from '../../../lib/pricing';

function NewOrder() {
  const router = useRouter();
  const { me } = useAuth();
  const sp = useSearchParams();
  const tierParam = sp.get('tier');
  const tier = isTier(tierParam) ? tierParam : 'EXPRESS';
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
    if (!prompt.trim() && tier !== 'TEMPLATE') {
      setAnalyzing(false);
      setBrief(null);
      return;
    }
    setAnalyzing(true);
    setBriefFailed(false);
    const asked = prompt;
    const ctrl = new AbortController();
    requestBrief({ prompt: asked, tier, templateId, framework }, ctrl.signal)
      // No API configured (local demo): simulated 2s analysis with the template brief.
      .then((b) => b ?? new Promise<AIBrief>((r) => setTimeout(() => r(genBrief(asked, tier, templateId, framework)), 2000)))
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
  }, [run, tier, templateId, framework]);

  const cfg = getTier(tier);
  const tpl = getTemplate(templateId);
  const est = estimate(tier, prompt, templateId);

  const stale = !!brief && analyzedPrompt !== null && prompt.trim() !== analyzedPrompt.trim();
  const blocker = !brief || analyzing
    ? null
    : stale
      ? 'Bạn đã sửa yêu cầu — bấm "Phân tích lại" để cập nhật đặc tả và giá.'
      : needPhone && !validPhone
        ? 'Nhập số điện thoại để GrabCode liên hệ về đơn.'
        : !agreed
          ? 'Tích đồng ý điều khoản để tạo đơn.'
          : null;

  const dispatch = async () => {
    if (!brief || stale) return;
    setSubmitting(true);
    if (ordersApiEnabled) {
      // Server prices the order (DRAFT); the order page shows the bank transfer that funds and dispatches it.
      setError(null);
      try {
        const created = await createOrder({ prompt, tier, templateId, framework, brief, acceptTerms: true, ...(needPhone && validPhone ? { phone: validPhone } : {}) });
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
      tier,
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
      tier,
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
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6">
          <span className="chip-ok">Gói {cfg.label} • ~{est.etaHours}h</span>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">Xác nhận đặc tả & đặt đơn</h1>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-4">
            <div className="card shadow-l2">
              <label htmlFor="prompt" className="mb-1 block font-display text-sm font-semibold text-ink">Yêu cầu của bạn</label>
              <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full resize-none p-3" placeholder="Mô tả app bạn cần..." />
              {stale && (
                <p className="mt-2 text-sm font-semibold text-amber-text" role="status">Bạn đã sửa yêu cầu — bấm Phân tích lại để cập nhật đặc tả và giá.</p>
              )}
              <button type="button" onClick={() => setRun((n) => n + 1)} disabled={analyzing || (!prompt.trim() && tier !== 'TEMPLATE')} className="btn-secondary mt-3 !py-2 !text-sm">
                <span className="material-symbols-outlined !text-[18px]" aria-hidden>refresh</span>
                Phân tích lại
              </button>
            </div>
            {briefFailed ? (
              <div className="card space-y-3 border-red-200 text-center" role="alert">
                <p className="font-display text-lg font-bold text-ink">AI chưa soạn được đặc tả</p>
                <p className="text-sm text-slate-700">Dịch vụ AI tạm thời không phản hồi. Bạn thử lại sau ít phút nhé.</p>
                <button type="button" className="btn-primary" onClick={() => setRun((n) => n + 1)}>Thử lại</button>
              </div>
            ) : (
              <AIBriefViewer brief={brief} analyzing={analyzing} />
            )}
          </div>
          <EscrowCheckout
            tierLabel={cfg.label}
            priceVnd={est.priceVnd}
            etaHours={est.etaHours}
            disabled={!brief || analyzing || !!blocker}
            hint={blocker}
            submitting={submitting}
            onConfirm={dispatch}
          >
            {needPhone && (
              <label className="block">
                <span className="font-display text-sm font-semibold text-ink">Số điện thoại (Zalo)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  aria-invalid={!!phone && !validPhone}
                  className="mt-1 w-full px-3 py-2"
                />
                <span className={`mt-1 block text-xs ${phone && !validPhone ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                  {phone && !validPhone ? 'Số di động Việt Nam chưa hợp lệ (10 số, bắt đầu 03/05/07/08/09).' : 'GrabCode gọi / nhắn Zalo khi cần xác nhận đơn. Lưu vào hồ sơ của bạn.'}
                </span>
              </label>
            )}
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                Tôi đồng ý{' '}
                <Link href="/dieu-khoan" target="_blank" className="font-semibold text-emerald-dark underline">Điều khoản sử dụng</Link> và{' '}
                <Link href="/chinh-sach-hoan-tien" target="_blank" className="font-semibold text-emerald-dark underline">Chính sách hoàn tiền</Link>.
              </span>
            </label>
          </EscrowCheckout>
        </div>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Đang tải...</div>}>
      <NewOrder />
    </Suspense>
  );
}
