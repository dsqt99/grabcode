import { BRAND } from '@grabcode/contracts';
import { splitBrandName } from '../lib/brand';

/** Brand mark: orange tile + delivery bag with a play glyph ("demo") and two speed bars ("giao nhanh"). Same artwork as app/icon1.svg. */
export function LogoMark({ size = 28, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="16" fill={tone === 'dark' ? '#EA580C' : '#C2410C'} />
      <rect x="7" y="30" width="10" height="4.5" rx="2.25" fill="#FDBA74" />
      <rect x="10" y="39" width="7" height="4.5" rx="2.25" fill="#FDBA74" />
      <path d="M26 24c0-4 2.6-7 6-7s6 3 6 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 25h22a2 2 0 0 1 2 2.1l-1.4 19a3 3 0 0 1-3 2.8H23.4a3 3 0 0 1-3-2.8L19 27.1A2 2 0 0 1 21 25Z" fill="#fff" />
      <path d="M29 31v10l8.5-5Z" fill={tone === 'dark' ? '#EA580C' : '#C2410C'} />
    </svg>
  );
}

/** Two-tone wordmark from BRAND.name: renaming again only touches brand.ts. */
export default function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [a, b] = splitBrandName(BRAND.name);
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark tone={tone} />
      <span className={`font-display text-xl font-extrabold tracking-tight md:text-2xl ${tone === 'dark' ? 'text-white' : 'text-stone-900'}`}>
        {a}<span className={tone === 'dark' ? 'text-brand-300' : 'text-brand-700'}>{b}</span>
      </span>
    </span>
  );
}
