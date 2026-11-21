'use client';

import { useEffect, useRef, useState } from 'react';
import DriverHeader from '../components/DriverHeader';
import OnlineRadar from '../components/OnlineRadar';
import WaveOfferModal from '../components/WaveOfferModal';
import ActiveJobWorkspace from '../components/ActiveJobWorkspace';
import PayoutCard from '../components/PayoutCard';
import JobBoard from '../components/JobBoard';
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-stone-50 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <DriverHeader
        walletVnd={state.walletVnd}
        todayEarningsVnd={state.todayEarningsVnd}
        isOnline={state.isOnline}
        walletFlash={walletFlash}
        compact={hasJob}
      />

      <div className="-mt-3 flex flex-col gap-4 rounded-t-3xl bg-stone-50 px-4 pt-4">
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
            {API_URL && <JobBoard onClaim={c.claimJob} />}
            {API_URL && <PayoutCard walletVnd={state.walletVnd} />}
            {state.history.length > 0 && (
              <section className="card">
                <h2 className="font-display text-lg font-bold">Đơn đã hoàn tất</h2>
                <ul className="mt-2 divide-y divide-stone-100">
                  {state.history.map((h) => (
                    <li key={h.orderId + h.at} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate">{h.title}</span>
                      <span className="chip-success shrink-0">+{formatVnd(h.payoutVnd)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Mock mode only: with core-api, offers come from real orders. */}
        {!API_URL && <button type="button" onClick={c.simulateDispatch} className="btn-outline btn-sm self-center border-dashed">
          <span className="material-symbols-outlined !text-[16px]" aria-hidden>science</span> Giả lập đơn đến
        </button>}
      </div>

      {c.offer && <WaveOfferModal key={c.offer.order.id} pending={c.offer} onAccept={c.acceptOffer} onReject={c.rejectOffer} />}

      <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md flex-col gap-2 px-4">
        {c.toasts.map((t) => (
          <div key={t.id} role={t.tone === 'warn' ? 'alert' : 'status'} className="toast animate-pop">
            <span
              className={`material-symbols-outlined shrink-0 ${t.tone === 'ok' ? 'text-teal-300' : t.tone === 'warn' ? 'text-red-300' : 'text-blue-300'}`}
              aria-hidden
            >
              {t.tone === 'ok' ? 'check_circle' : t.tone === 'warn' ? 'error' : 'info'}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
