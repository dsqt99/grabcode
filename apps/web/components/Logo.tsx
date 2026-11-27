import { BRAND } from '@grabcode/contracts';
import { BrandMark } from '@grabcode/auth-ui';
import { splitBrandName } from '../lib/brand';

/** Brand mark: shared BrandMark from auth-ui (same artwork as app/icon1.svg). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return <BrandMark size={size} />;
}

/** Two-tone wordmark from BRAND.name: renaming again only touches brand.ts. */
export default function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [a, b] = splitBrandName(BRAND.name);
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`font-display text-xl font-extrabold tracking-tight md:text-2xl ${tone === 'dark' ? 'text-white' : 'text-stone-900'}`}>
        {a}<span className={tone === 'dark' ? 'text-brand-300' : 'text-brand-700'}>{b}</span>
      </span>
    </span>
  );
}
