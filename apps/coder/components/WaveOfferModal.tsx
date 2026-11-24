'use client';

import { useEffect, useRef, useState } from 'react';
import { etaLabel } from '@grabcode/contracts/schemas';
import type { PendingOffer } from '../lib/coderStore';
import { formatVnd } from '../lib/coderStore';

const TIER_LABEL: Record<string, string> = {
  EXPRESS: 'Express',
  STANDARD: 'Standard',
  PRO: 'Pro',
  TEMPLATE: 'Template',
};

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const play = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.25);
    };
    play(0, 880);
    play(0.28, 1175);
    setTimeout(() => void ctx.close().catch(() => undefined), 1000);
  } catch {
    /* audio blocked or unsupported */
  }
}

export default function WaveOfferModal({
  pending,
  onAccept,
  onReject,
}: {
  pending: PendingOffer;
  onAccept: () => void;
  onReject: (reason: 'DECLINED' | 'TIMEOUT') => void;
}) {
  const total = Math.max(1, pending.offer.expiresInSeconds || 30);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, pending.expiresAt - Date.now()));
  const rejected = useRef(false);

  useEffect(() => {
    beep();
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, pending.expiresAt - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !rejected.current) {
        rejected.current = true;
        onReject('TIMEOUT');
      }
    }, 200);
    return () => clearInterval(t);
  }, [pending.expiresAt, onReject]);

  const secs = Math.ceil(remainingMs / 1000);
  const R = 28;
  const C = 2 * Math.PI * R;
  const frac = Math.min(1, remainingMs / (total * 1000));
  const urgent = secs <= 10;
  const { offer, order } = pending;
  // Screen readers hear only the 10s and 5s marks, not every tick.
  const announce = secs === 10 || secs === 5 ? `Còn ${secs} giây` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="w-full max-w-md animate-pop rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-sheet sm:rounded-3xl sm:shadow-overlay"
      >
        <span className="sr-only" aria-live="polite">{announce}</span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="chip-progress">
              <span className="material-symbols-outlined !text-[14px]" aria-hidden>bolt</span> Đơn mới
            </span>
            <h2 id="offer-title" className="mt-2 font-display text-xl font-extrabold leading-tight text-stone-900">{offer.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{offer.customerName}</p>
          </div>
          <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`Còn ${secs} giây`}>
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r={R} fill="none" stroke="#FEF3C7" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke={urgent ? '#B45309' : '#F59E0B'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                style={{ transition: 'stroke-dashoffset 0.2s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold tabular-nums text-amber-800" aria-hidden>
              {secs}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-teal-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Bạn nhận</p>
          <p className="font-display text-[28px] font-extrabold tabular-nums text-teal-800">{formatVnd(offer.netPayoutVnd)}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip-dark">{TIER_LABEL[offer.tier] ?? offer.tier}</span>
          <span className="chip-warn">
            <span className="material-symbols-outlined !text-[14px]" aria-hidden>schedule</span> {etaLabel(offer.deadlineHours)}
          </span>
          {(offer.templateName || order.templateName) && <span className="chip-neutral">{offer.templateName || order.templateName}</span>}
        </div>

        <p className="mt-3 line-clamp-3 text-sm text-stone-700">{offer.summary}</p>

        <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
          <button type="button" className="btn-outline min-h-[52px]" onClick={() => { rejected.current = true; onReject('DECLINED'); }}>
            Bỏ qua
          </button>
          <button type="button" className="btn-primary min-h-[52px] text-base" onClick={() => { rejected.current = true; onAccept(); }}>
            Nhận đơn
          </button>
        </div>
      </div>
    </div>
  );
}
