'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { eventBus, type AIBrief, type Order, type WaveOffer } from '@grabcode/contracts';
import AIBriefViewer from '../../../components/AIBriefViewer';
import EscrowCheckout from '../../../components/EscrowCheckout';
import Navbar from '../../../components/Navbar';
import { genBrief } from '../../../lib/brief';
import { newOrderId, saveOrder } from '../../../lib/orderStore';
import { FRAMEWORKS, estimate, getTemplate, getTier, isTier } from '../../../lib/pricing';

function NewOrder() {
  const router = useRouter();
  const sp = useSearchParams();
  const tierParam = sp.get('tier');
  const tier = isTier(tierParam) ? tierParam : 'EXPRESS';
  const templateId = sp.get('template');
  const framework = sp.get('framework') ?? FRAMEWORKS[0];
  const initialPrompt = sp.get('prompt') ?? '';

  const [prompt, setPrompt] = useState(initialPrompt);
  const [brief, setBrief] = useState<AIBrief | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [run, setRun] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!prompt.trim() && tier !== 'TEMPLATE') {
      setAnalyzing(false);
      setBrief(null);
      return;
    }
    setAnalyzing(true);
    const t = setTimeout(() => {
      setBrief(genBrief(prompt, tier, templateId, framework));
      setAnalyzing(false);
    }, 2000);
    return () => clearTimeout(t);
    // Re-run only when the user requests a new analysis (run) or inputs from URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, tier, templateId, framework]);

  const cfg = getTier(tier);
  const tpl = getTemplate(templateId);
  const est = estimate(tier, prompt, templateId);

  const dispatch = () => {
    if (!brief) return;
    setSubmitting(true);
    const id = newOrderId();
    const now = new Date().toISOString();
    const order: Order = {
      id,
      tier,
      title: brief.title.replace(/^Đặc tả kỹ thuật:\s*/, ''),
      customerName: 'Khách hàng Demo',
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
      netPayoutVnd: Math.round((est.priceVnd * 0.7) / 1000) * 1000,
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
          <h1 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">Xác nhận đặc tả & ký quỹ</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="card shadow-l2">
              <label htmlFor="prompt" className="mb-1 block font-display text-sm font-semibold text-ink">Yêu cầu của bạn</label>
              <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full resize-none p-3" placeholder="Mô tả POC cần dựng..." />
              <button type="button" onClick={() => setRun((n) => n + 1)} disabled={!prompt.trim() && tier !== 'TEMPLATE'} className="btn-secondary mt-3 !py-2 !text-sm">
                <span className="material-symbols-outlined !text-[18px]" aria-hidden>refresh</span>
                Phân tích lại
              </button>
            </div>
            <AIBriefViewer brief={brief} analyzing={analyzing} />
          </div>
          <EscrowCheckout
            tierLabel={cfg.label}
            priceVnd={est.priceVnd}
            etaHours={est.etaHours}
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
