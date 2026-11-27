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
  /** Shown above the buttons while confirm is disabled, so a locked button always says why (redesign-web-order §8). */
  blockedReason?: string;
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
export default function ConfirmSheet({ open, title, children, confirmLabel, danger, canConfirm = true, blockedReason, busy, error, cancelLabel = 'Huỷ', onConfirm, onClose }: Props) {
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
  const blocked = !canConfirm && !busy;

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-white p-0 text-stone-900 shadow-sheet backdrop:bg-ink/50 md:m-auto md:max-w-lg md:rounded-3xl md:shadow-overlay"
    >
      {open && (
        <>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />
          <div className="space-y-4 px-4 pt-3 md:px-6 md:pt-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="confirm-sheet-title" className="pt-2 font-display text-lg font-bold md:text-xl">{title}</h2>
              <button type="button" className="btn-icon -mr-2" aria-label="Đóng" disabled={busy} onClick={close}>
                <span className="material-symbols-outlined" aria-hidden>close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm text-stone-700">{children}</div>
            {error && (
              <p className="banner-danger font-semibold" role="alert">
                <span className="material-symbols-outlined text-[20px]!" aria-hidden>error</span>
                Chưa thực hiện được: {error}. Thử lại.
              </p>
            )}
          </div>
          <div className="sticky bottom-0 space-y-2 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-6">
            {blocked && blockedReason && <p className="text-sm font-semibold text-amber-800">{blockedReason}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-outline flex-1" disabled={busy} onClick={close}>
                {cancelLabel}
              </button>
              <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-2 whitespace-nowrap px-3 text-sm md:text-[15px]`} disabled={!canConfirm || busy} onClick={onConfirm}>
                {busy && <span className="material-symbols-outlined spinner" aria-hidden>progress_activity</span>}
                {confirmLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
