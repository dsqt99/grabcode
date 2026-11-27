"use client";

import { BrandMark, useAuth } from "@grabcode/auth-ui";
import { formatVnd } from "../lib/coderStore";

const TIER_LABEL: Record<string, string> = {
  BRONZE: "Đồng",
  SILVER: "Bạc",
  GOLD: "Vàng",
  DIAMOND: "Kim cương",
};

export default function DriverHeader({
  walletVnd,
  todayEarningsVnd,
  isOnline,
  walletFlash,
  compact = false,
}: {
  walletVnd: number;
  todayEarningsVnd: number;
  isOnline: boolean;
  walletFlash: boolean;
  /** During an active job: one row only, the job owns the screen. */
  compact?: boolean;
}) {
  const { me, logout } = useAuth();
  // Tier/rating only from core-api (rating null until reviews exist); no profile: nothing shown.
  const c = { tier: me?.coderStats?.tier ?? null, rating: me?.coderStats?.rating ?? null };
  const name = me?.name ?? "Freelancer";
  const avatar = me?.avatarUrl ?? null;
  return (
    <header className={`bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] text-white ${compact ? "pb-5" : "pb-6"}`}>
      <div className="flex items-center gap-3">
        <BrandMark size={32} className="shrink-0" />
        <div className="relative">
          {avatar ? (
            <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-brand-600" />
          ) : (
            <span className="material-symbols-outlined grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[28px]! ring-2 ring-brand-600" aria-hidden>
              person
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink ${isOnline ? "bg-teal-400" : "bg-stone-500"}`}
            role="img"
            aria-label={isOnline ? "Đang nhận đơn" : "Đang tắt nhận đơn"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{name}</p>
          {(c.tier || c.rating !== null) && (
            <div className="mt-0.5 flex items-center gap-2">
              {c.tier && (
                <span className="chip bg-white/10 min-h-0! py-0.5 text-brand-200">
                  <span className="material-symbols-outlined text-[14px]!" aria-hidden>military_tech</span>
                  {TIER_LABEL[c.tier] ?? c.tier}
                </span>
              )}
              {c.rating !== null && (
                <span className="flex items-center gap-0.5 font-display text-sm font-semibold text-amber-300">
                  <span className="material-symbols-outlined text-[16px]!" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>star</span>
                  {c.rating.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
        {me && (
          // Plain <a>: /profile lives in the web app, outside this app's /coder basePath.
          <a href="/profile" className="btn-icon text-stone-300 hover:bg-white/10" aria-label="Hồ sơ & cài đặt">
            <span className="material-symbols-outlined" aria-hidden>manage_accounts</span>
          </a>
        )}
        {me && (
          <button type="button" onClick={() => logout()} className="btn-icon text-stone-300 hover:bg-white/10" aria-label="Đăng xuất">
            <span className="material-symbols-outlined" aria-hidden>logout</span>
          </button>
        )}
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-stone-300">
              <span className="material-symbols-outlined text-[16px]!" aria-hidden>account_balance_wallet</span> Số dư ví
            </p>
            <p className={`mt-1 font-display text-lg font-extrabold tabular-nums transition-all duration-500 ${walletFlash ? "scale-105 text-brand-300" : "text-white"}`}>
              {formatVnd(walletVnd)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-stone-300">
              <span className="material-symbols-outlined text-[16px]!" aria-hidden>payments</span> Thu nhập hôm nay
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-brand-300">{formatVnd(todayEarningsVnd)}</p>
          </div>
        </div>
      )}
    </header>
  );
}
