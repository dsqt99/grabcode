'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Confirm stays disabled until the user ticked / typed what the sheet asks for. */
  canConfirm?: boolean;
  busy?: boolean;
  /** Shown inside the sheet; what the user typed is kept so they can retry. */
  error?: string | null;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation step before any money action (UX spec HON-18 "Màn C"): bottom sheet on mobile, centered dialog on desktop.
 * Native <dialog>: focus stays inside while open, Esc / backdrop close it (not while sending), focus returns to the opener.
 */
export default function ConfirmSheet({ open, title, children, confirmLabel, danger, canConfirm = true, busy, error, cancelLabel = 'Huỷ', onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  // The order page unmounts the sheet instead of passing open=false: give focus back to the opener then too (Màn C AC4).
  // A successful action can remove the opener (e.g. "Xem & duyệt M1"): fall back to the page heading, not <body>.
  useEffect(
    () => () => {
      const el = opener.current as HTMLElement | null;
      const target = el?.isConnected ? el : document.querySelector<HTMLElement>('main h1');
      if (target && !el?.isConnected) target.tabIndex = -1;
      target?.focus?.();
    },
    [],
  );

  const close = () => !busy && onClose();

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-white p-0 text-ink shadow-l3 backdrop:bg-ink/40 md:m-auto md:max-w-md md:rounded-2xl"
    >
      {open && (
        <div className="space-y-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <h2 id="confirm-sheet-title" className="font-display text-lg font-bold">{title}</h2>
          <div className="space-y-3 text-sm text-slate-700">{children}</div>
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
              Chưa thực hiện được: {error}. Thử lại.
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost min-h-[44px] flex-1 border border-slate-200" disabled={busy} onClick={close}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`min-h-[44px] flex-[2] ${danger ? 'inline-flex items-center justify-center rounded-full bg-red-700 px-6 py-3 font-display text-[15px] font-semibold text-white disabled:opacity-50' : 'btn-primary'}`}
              disabled={!canConfirm || busy}
              onClick={onConfirm}
            >
              {busy && <span className="material-symbols-outlined animate-spin !text-[18px]" aria-hidden>progress_activity</span>}
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
