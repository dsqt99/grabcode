import { BRAND } from '@grabcode/contracts';
import { splitBrandName } from '../lib/brand';

/** Brand mark: indigo tile + play glyph ("xem demo") with two speed bars ("nhanh"). Same artwork as app/icon1.svg. */
export function LogoMark({ size = 28, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="16" fill={tone === 'dark' ? '#4F46E5' : '#4338CA'} />
      <rect x="12" y="25" width="11" height="5" rx="2.5" fill="#A5B4FC" />
      <rect x="15" y="34" width="8" height="5" rx="2.5" fill="#A5B4FC" />
      <path d="M28 20.6v22.8a2 2 0 0 0 3.06 1.7l18.3-11.4a2 2 0 0 0 0-3.4L31.06 18.9A2 2 0 0 0 28 20.6Z" fill="#fff" />
    </svg>
  );
}

/** Two-tone wordmark from BRAND.name: renaming again only touches brand.ts. */
export default function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [a, b] = splitBrandName(BRAND.name);
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark tone={tone} />
      <span className={`font-display text-xl font-extrabold tracking-tight md:text-2xl ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>
        {a}<span className={tone === 'dark' ? 'text-inverse-primary' : 'text-brand-strong'}>{b}</span>
      </span>
    </span>
  );
}
