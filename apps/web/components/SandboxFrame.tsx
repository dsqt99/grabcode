'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@grabcode/contracts';
import { buildPreviewHtml } from '../lib/orderView';

export default function SandboxFrame({ order, delivered }: { order: Order; delivered: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const html = useMemo(() => buildPreviewHtml(order), [order]);
  // No sandboxStatus = mock mode (or no repo): keep the generated preview.
  const live = order.demoUrl;
  const url = live ?? `https://${order.id.toLowerCase()}.preview.grabcode.dev`;
  const status = order.sandboxStatus;
  const shown = delivered && (live || !status);

  const openNewTab = () => {
    if (live) return window.open(live, '_blank', 'noopener');
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(blobUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const iconBtn = 'grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink active:scale-90 disabled:opacity-40';

  return (
    <section aria-label="Sandbox preview" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-l2">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button type="button" className={iconBtn} disabled={!shown} onClick={() => setReloadKey((k) => k + 1)} aria-label="Tải lại">
          <span className="material-symbols-outlined !text-[18px]" aria-hidden>refresh</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
          <span className="material-symbols-outlined !text-[14px] text-emerald" aria-hidden>{shown ? 'lock' : 'lock_clock'}</span>
          <span className="truncate">{shown ? url : 'Link demo sẽ hiện khi Coder bàn giao'}</span>
        </div>
        <button type="button" className={iconBtn} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} aria-label="Xem desktop">
          <span className={`material-symbols-outlined !text-[18px] ${device === 'desktop' ? 'text-emerald' : ''}`} aria-hidden>desktop_windows</span>
        </button>
        <button type="button" className={iconBtn} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} aria-label="Xem mobile">
          <span className={`material-symbols-outlined !text-[18px] ${device === 'mobile' ? 'text-emerald' : ''}`} aria-hidden>smartphone</span>
        </button>
        <button type="button" className={iconBtn} disabled={!shown} onClick={openNewTab} aria-label="Mở tab mới">
          <span className="material-symbols-outlined !text-[18px]" aria-hidden>open_in_new</span>
        </button>
      </div>

      <div className="grid min-h-[320px] place-items-center bg-slate-100 p-3">
        {shown ? (
          <iframe
            key={reloadKey}
            title={`Bản demo ${order.title}`}
            {...(live ? { src: live, sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups' } : { srcDoc: html, sandbox: '' })}
            className={`h-[420px] rounded-md border border-slate-200 bg-white transition-all duration-300 ${device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className={`material-symbols-outlined !text-5xl text-slate-300 ${delivered && status === 'PENDING' ? 'animate-spin' : ''}`} aria-hidden>
              {!delivered ? 'lock' : status === 'PENDING' ? 'progress_activity' : status === 'FAILED' ? 'error' : 'timer_off'}
            </span>
            <p className="font-display font-bold text-ink">
              {!delivered ? 'Sandbox đang bị khóa' : status === 'PENDING' ? 'Đang dựng bản demo…' : status === 'FAILED' ? 'Dựng bản demo thất bại' : 'Bản demo đã hết hạn'}
            </p>
            <p className="max-w-xs whitespace-pre-wrap break-words text-sm text-slate-500">
              {!delivered
                ? 'Bản demo sẽ mở khóa sau khi Coder hoàn tất các mốc và vượt QA Gate.'
                : status === 'PENDING'
                  ? 'Thường mất vài phút.'
                  : status === 'FAILED'
                    ? order.sandboxError
                    : 'Link demo chỉ giữ trong thời gian giới hạn. Mã nguồn vẫn ở repo của bạn.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
