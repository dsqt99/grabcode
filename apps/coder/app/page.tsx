'use client';

import { useEffect, useRef, useState } from 'react';
import DriverHeader from '../components/DriverHeader';
import OnlineRadar from '../components/OnlineRadar';
import WaveOfferModal from '../components/WaveOfferModal';
import ActiveJobWorkspace from '../components/ActiveJobWorkspace';
import PayoutCard from '../components/PayoutCard';
import { API_URL } from '@grabcode/auth-ui';
import { formatVnd, useCoder } from '../lib/coderStore';

export default function Page() {
  const c = useCoder();
  const { state } = c;
  const [walletFlash, setWalletFlash] = useState(false);
  const lastWallet = useRef(state.walletVnd);

  useEffect(() => {
    if (state.walletVnd > lastWallet.current) {
      setWalletFlash(true);
      const t = setTimeout(() => setWalletFlash(false), 1800);
      lastWallet.current = state.walletVnd;
      return () => clearTimeout(t);
    }
    lastWallet.current = state.walletVnd;
  }, [state.walletVnd]);

  const hasJob = !!state.activeOrder;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md pb-[max(2rem,env(safe-area-inset-bottom))]">
      <DriverHeader
        walletVnd={state.walletVnd}
        todayEarningsVnd={state.todayEarningsVnd}
        isOnline={state.isOnline}
        walletFlash={walletFlash}
        compact={hasJob}
      />

      <div className="-mt-3 flex flex-col gap-4 rounded-t-xl bg-[#f8fafc] px-4 pt-4">
        {hasJob ? (
          <ActiveJobWorkspace
            state={state}
            onCompleteMilestone={c.completeMilestone}
            onDeliver={c.deliver}
            onSendChat={c.sendChat}
            onDismiss={c.dismissJob}
          />
        ) : (
          <>
            <OnlineRadar isOnline={state.isOnline} onToggle={c.setOnline} />
            {API_URL && <PayoutCard />}
            {state.history.length > 0 && (
              <section className="card">
                <h3 className="font-display text-sm font-bold">Cuốc đã hoàn thành</h3>
                <ul className="mt-2 divide-y divide-slate-100">
                  {state.history.map((h) => (
                    <li key={h.orderId + h.at} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate">{h.title}</span>
                      <span className="chip-ok shrink-0">+{formatVnd(h.payoutVnd)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Mock mode only: with core-api, offers come from real orders. */}
        {!API_URL && <button type="button" onClick={c.simulateDispatch} className="btn-secondary min-h-[48px] self-center !px-4 !py-2 text-xs">
          <span className="material-symbols-outlined !text-[16px]">science</span> Giả lập đơn đến
        </button>}
      </div>

      {c.offer && <WaveOfferModal key={c.offer.order.id} pending={c.offer} onAccept={c.acceptOffer} onReject={c.rejectOffer} />}

      <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md flex-col gap-2 px-4">
        {c.toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-pop rounded-full px-5 py-3 text-center font-display text-sm font-bold shadow-l3 ${
              t.tone === 'ok' ? 'bg-emerald text-white' : t.tone === 'warn' ? 'bg-amber-tint text-amber-text' : 'bg-ink text-white'
            }`}
          >
            {t.tone === 'ok' && '🎉 '}
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
