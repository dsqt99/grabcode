'use client';

import { useEffect, useState } from 'react';

/** Copies `value` (already in the form the bank app expects) and says so for 1.5s, also to screen readers. */
export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const copy = () =>
    navigator.clipboard.writeText(value).then(
      () => setState('done'),
      () => setState('failed'),
    );

  return (
    <button type="button" onClick={copy} aria-label={`Sao chép ${label}`} className="btn-secondary btn-sm shrink-0">
      <span aria-live="polite">{state === 'done' ? 'Đã chép ✓' : state === 'failed' ? 'Chép tay giúp' : 'Sao chép'}</span>
    </button>
  );
}
