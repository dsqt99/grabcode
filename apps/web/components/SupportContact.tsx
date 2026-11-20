import { SUPPORT, hasSupport } from '../lib/support';

/** Zalo / hotline links (env); renders nothing when none is configured (production builds require one). */
export default function SupportContact({ className = '' }: { className?: string }) {
  if (!hasSupport) return null;
  return (
    <span className={`inline-flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {[SUPPORT.zalo, SUPPORT.hotline].map(
        (c) =>
          c && (
            <a key={c.href} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold text-brand-800 underline">
              {c.label}
            </a>
          ),
      )}
    </span>
  );
}
