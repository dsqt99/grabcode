'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { estimateOrder, payoutOf } from '@grabcode/contracts/schemas';
import { eventBus, type AIBrief, type Order, type WaveOffer } from '@grabcode/contracts';
import AIBriefViewer from '../../../components/AIBriefViewer';
import EscrowCheckout from '../../../components/EscrowCheckout';
import Navbar from '../../../components/Navbar';
import { createOrder, ordersApiEnabled, requestBrief } from '../../../lib/api';
import { useAuth } from '@grabcode/auth-ui';
import { genBrief } from '../../../lib/brief';
import { newOrderId, saveOrder } from '../../../lib/orderStore';
import { FRAMEWORKS, daysLabel, getMenuItem, getTemplate } from '../../../lib/pricing';

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
  const [analyzing, setAnalyzing] = useState(true);
  const [run, setRun] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prompt.trim()) {
      setAnalyzing(false);
      setBrief(null);
      return;
    }
    setAnalyzing(true);
    const ctrl = new AbortController();
    const local = () => genBrief(prompt, item.code, templateId, framework);
    requestBrief({ prompt, templateId, framework }, ctrl.signal)
      // No API configured: keep the POC's simulated 2s analysis.
      .then((b) => b ?? new Promise<AIBrief>((r) => setTimeout(() => r(local()), 2000)))
      .catch((err) => {
        if (ctrl.signal.aborted) throw err;
        console.warn('AI brief unavailable, using local template:', err);
        return local();
      })
      .then((b) => {
        if (ctrl.signal.aborted) return;
        setBrief(b);
        setAnalyzing(false);
      })
      .catch(() => {}); // aborted by a newer run
    return () => ctrl.abort();
    // Re-run only when the user requests a new analysis (run) or inputs from URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, item.code, templateId, framework]);

  const tpl = getTemplate(templateId);
  // "Giá từ" of the item: the server creates the order with it and an admin quotes the final price before payment.
  const est = estimateOrder(item.code);

  const dispatch = async () => {
    if (!brief) return;
    setSubmitting(true);
    if (ordersApiEnabled) {
      // DRAFT at the item's "giá từ"; the order page shows the transfer QR once an admin quoted the price.
      setError(null);
      try {
        const created = await createOrder({ prompt, menuItem: item.code, templateId, framework, brief });
        router.push(`/order/${created.id}`);
      } catch (e) {
        console.error(e);
        setError('Không tạo được đơn. Vui lòng thử lại.');
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
      customerName: me?.name ?? 'Khách hàng Demo',
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
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6">
          <span className="chip-ok">{item.name} • {daysLabel(item.days)}</span>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">Xác nhận đặc tả & ký quỹ</h1>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="card shadow-l2">
              <label htmlFor="prompt" className="mb-1 block font-display text-sm font-semibold text-ink">Yêu cầu của bạn</label>
              <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full resize-none p-3" placeholder="Mô tả POC cần dựng..." />
              <button type="button" onClick={() => setRun((n) => n + 1)} disabled={!prompt.trim()} className="btn-secondary mt-3 !py-2 !text-sm">
                <span className="material-symbols-outlined !text-[18px]" aria-hidden>refresh</span>
                Phân tích lại
              </button>
            </div>
            <AIBriefViewer brief={brief} analyzing={analyzing} />
          </div>
          <EscrowCheckout
            itemName={item.name}
            fromPriceVnd={item.fromPriceVnd}
            days={item.days}
            disabled={!brief || analyzing}
            submitting={submitting}
            onConfirm={dispatch}
          />
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
