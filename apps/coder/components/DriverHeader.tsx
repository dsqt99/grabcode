"use client";

import { SEED_CODER } from "@grabcode/contracts";
import { useAuth } from "@grabcode/auth-ui";
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
  // Signed in: tier/rating from core-api (rating null until reviews exist); mock mode: SEED_CODER.
  const c = me ? { tier: me.coderStats?.tier ?? "BRONZE", rating: me.coderStats?.rating ?? null } : SEED_CODER;
  const name = me?.name ?? SEED_CODER.name;
  const avatar = me ? me.avatarUrl : SEED_CODER.avatar;
  return (
    <header
      className={`bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] text-white ${compact ? "pb-5" : "pb-6"}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald"
            />
          ) : (
            <span
              className="material-symbols-outlined grid h-12 w-12 place-items-center rounded-full bg-white/10 !text-[32px] ring-2 ring-emerald"
              aria-hidden
            >
              person
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink ${
              isOnline ? "bg-emerald" : "bg-slate-500"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="chip bg-amber-tint !py-0.5 text-amber-text">
              <span className="material-symbols-outlined !text-[14px]">
                military_tech
              </span>
              {TIER_LABEL[c.tier]} · {c.tier}
            </span>
            {c.rating !== null && (
            <span className="flex items-center gap-0.5 font-display text-sm font-semibold text-amber">
              <span
                className="material-symbols-outlined !text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              {c.rating.toFixed(2)}
            </span>
            )}
          </div>
        </div>
        {me && (
          // Plain <a>: /profile lives in the web app, outside this app's /coder basePath.
          <a
            href="/profile"
            className="grid h-11 w-11 place-items-center rounded-full text-slate-300 hover:bg-white/10"
            aria-label="Hồ sơ & cài đặt"
          >
            <span className="material-symbols-outlined" aria-hidden>
              manage_accounts
            </span>
          </a>
        )}
        {me && (
          <button
            type="button"
            onClick={() => logout()}
            className="grid h-11 w-11 place-items-center rounded-full text-slate-300 hover:bg-white/10"
            aria-label="Đăng xuất"
          >
            <span className="material-symbols-outlined" aria-hidden>
              logout
            </span>
          </button>
        )}
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-slate-300">
              <span className="material-symbols-outlined !text-[16px]">
                account_balance_wallet
              </span>{" "}
              Ví Coder
            </p>
            <p
              className={`mt-1 font-display text-lg font-extrabold transition-all duration-500 ${
                walletFlash ? "scale-105 text-inverse-primary" : "text-white"
              }`}
            >
              {formatVnd(walletVnd)}
            </p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="flex items-center gap-1 text-xs text-slate-300">
              <span className="material-symbols-outlined !text-[16px]">
                payments
              </span>{" "}
              Thu nhập hôm nay
            </p>
            <p className="mt-1 font-display text-lg font-extrabold text-inverse-primary">
              {formatVnd(todayEarningsVnd)}
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
