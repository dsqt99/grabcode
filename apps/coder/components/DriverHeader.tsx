'use client';

import { SEED_CODER } from '@grabcode/contracts';
import { formatVnd } from '../lib/coderStore';

const TIER_LABEL: Record<string, string> = {
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  DIAMOND: 'Kim cương',
};

export default function DriverHeader({
  walletVnd,
  todayEarningsVnd,
  isOnline,
  walletFlash,
}: {
  walletVnd: number;
  todayEarningsVnd: number;
  isOnline: boolean;
  walletFlash: boolean;
}) {
  const c = SEED_CODER;
  return (
    <header className="bg-ink px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="flex items-center gap-3">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.avatar} alt={c.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink ${
              isOnline ? 'bg-emerald' : 'bg-slate-500'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{c.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="chip bg-amber-tint !py-0.5 text-amber-text">
              <span className="material-symbols-outlined !text-[14px]">military_tech</span>
              {TIER_LABEL[c.tier]} · {c.tier}
            </span>
            <span className="flex items-center gap-0.5 font-display text-sm font-semibold text-amber">
              <span className="material-symbols-outlined !text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              {c.rating.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/10 p-3">
          <p className="flex items-center gap-1 text-xs text-slate-300">
            <span className="material-symbols-outlined !text-[16px]">account_balance_wallet</span> Ví Coder
          </p>
          <p
            className={`mt-1 font-display text-lg font-extrabold transition-all duration-500 ${
              walletFlash ? 'scale-105 text-inverse-primary' : 'text-white'
            }`}
          >
            {formatVnd(walletVnd)}
          </p>
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <p className="flex items-center gap-1 text-xs text-slate-300">
            <span className="material-symbols-outlined !text-[16px]">payments</span> Thu nhập hôm nay
          </p>
          <p className="mt-1 font-display text-lg font-extrabold text-inverse-primary">{formatVnd(todayEarningsVnd)}</p>
        </div>
      </div>
    </header>
  );
}
