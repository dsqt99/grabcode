'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@grabcode/contracts';
import { buildPreviewHtml } from '../lib/orderView';

export default function SandboxFrame({ order, delivered }: { order: Order; delivered: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const html = useMemo(() => buildPreviewHtml(order), [order]);
  const url = order.demoUrl ?? `https://${order.id.toLowerCase()}.preview.grabcode.dev`;

  const openNewTab = () => {
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(blobUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const iconBtn = 'grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink active:scale-90 disabled:opacity-40';

  return (
    <section aria-label="Sandbox preview" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-l2">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button type="button" className={iconBtn} disabled={!delivered} onClick={() => setReloadKey((k) => k + 1)} aria-label="Tải lại">
          <span className="material-symbols-outlined !text-[18px]" aria-hidden>refresh</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
          <span className="material-symbols-outlined !text-[14px] text-emerald" aria-hidden>{delivered ? 'lock' : 'lock_clock'}</span>
          <span className="truncate">{delivered ? url : 'Link demo sẽ hiện khi Coder bàn giao'}</span>
        </div>
        <button type="button" className={iconBtn} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} aria-label="Xem desktop">
          <span className={`material-symbols-outlined !text-[18px] ${device === 'desktop' ? 'text-emerald' : ''}`} aria-hidden>desktop_windows</span>
        </button>
        <button type="button" className={iconBtn} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} aria-label="Xem mobile">
          <span className={`material-symbols-outlined !text-[18px] ${device === 'mobile' ? 'text-emerald' : ''}`} aria-hidden>smartphone</span>
        </button>
        <button type="button" className={iconBtn} disabled={!delivered} onClick={openNewTab} aria-label="Mở tab mới">
          <span className="material-symbols-outlined !text-[18px]" aria-hidden>open_in_new</span>
        </button>
      </div>

      <div className="grid min-h-[320px] place-items-center bg-slate-100 p-3">
        {delivered ? (
          <iframe
            key={reloadKey}
            title={`Bản demo ${order.title}`}
            srcDoc={html}
            sandbox=""
            className={`h-[420px] rounded-md border border-slate-200 bg-white transition-all duration-300 ${device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined !text-5xl text-slate-300" aria-hidden>lock</span>
            <p className="font-display font-bold text-ink">Sandbox đang bị khóa</p>
            <p className="max-w-xs text-sm text-slate-500">Bản demo sẽ mở khóa sau khi Coder hoàn tất các mốc và vượt QA Gate.</p>
          </div>
        )}
      </div>
    </section>
  );
}
