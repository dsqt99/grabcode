'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Bottom sheet (mobile) / centered modal (desktop) on a native <dialog>: Esc closes, focus returns to the opener.
 * Same structure as apps/web ConfirmSheet (copied, apps do not import each other).
 */
export default function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-white p-0 shadow-sheet backdrop:bg-ink/50 md:m-auto md:max-w-lg md:rounded-3xl md:shadow-overlay"
    >
      {open && (
        <div className="px-4 pt-2 md:px-6 md:pt-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />
          <div className="mt-3 flex items-start justify-between gap-2">
            <h2 id={titleId} className="font-display text-lg font-bold text-stone-900">{title}</h2>
            <button type="button" className="btn-icon -mr-2 -mt-1" aria-label="Đóng" onClick={onClose}>
              <span className="material-symbols-outlined" aria-hidden>close</span>
            </button>
          </div>
          <div className="mt-3 space-y-3">{children}</div>
          <div className="sticky bottom-0 mt-4 flex gap-3 bg-white pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div>
        </div>
      )}
    </dialog>
  );
}
