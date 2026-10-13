import type { Order, OrderStatus } from '@grabcode/contracts';

export const STAGES = [
  { key: 'match', label: 'Đang ghép Coder', icon: 'radar' },
  { key: 'build', label: 'Coder đang build', icon: 'code' },
  { key: 'qa', label: 'QA Gate', icon: 'fact_check' },
  { key: 'ready', label: 'Sẵn sàng nghiệm thu', icon: 'verified' },
] as const;

/** Index of the active stage (0-3). Returns 4 when the whole flow is done. */
export function stageIndex(status: OrderStatus): number {
  switch (status) {
    case 'DRAFT':
    case 'DISPATCHING':
    case 'CANCELLED':
      return 0;
    case 'ACCEPTED':
    case 'BUILDING':
      return 1;
    case 'QA_TESTING':
      return 2;
    case 'DELIVERED':
      return 3;
    case 'COMPLETED':
      return 4;
  }
}

export function progressPercent(order: Order): number {
  if (order.status === 'DELIVERED' || order.status === 'COMPLETED') return 100;
  const done = order.brief.milestones.filter((m) => m.status === 'COMPLETED').reduce((s, m) => s + m.weightPercent, 0);
  return Math.min(100, done);
}

/** Show ISO timestamps as HH:mm:ss; pass through relative text ("10 phút trước"). */
export function formatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime()) || !/^\d{4}-/.test(ts)) return ts;
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Self-contained mock preview of the delivered app (no external requests). */
export function buildPreviewHtml(order: Order): string {
  const features = order.brief.features.slice(0, 4);
  const cols = ['Mới', 'Đang xử lý', 'Hoàn tất'];
  const cards = features
    .map((f, i) => `<div class="c"><b>#${i + 1}</b><span>${esc(f)}</span></div>`)
    .join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a}
header{background:#00b14f;color:#fff;padding:14px 20px;font-weight:800;display:flex;justify-content:space-between;align-items:center}
header small{font-weight:500;opacity:.85}
main{padding:20px;max-width:960px;margin:auto}
h1{font-size:20px;margin:0 0 4px}p{color:#475569;font-size:14px;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.col{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px}
.col h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 8px}
.c{background:#e8f8ee;border-radius:10px;padding:10px;margin-bottom:8px;font-size:13px;display:flex;gap:8px}
.c b{color:#00873d}
.btn{display:inline-block;background:#00b14f;color:#fff;border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px;margin-top:8px}
</style></head><body>
<header><span>${esc(order.title)}</span><small>${esc(order.id)} - bản demo</small></header>
<main><h1>${esc(order.title)}</h1><p>${esc(order.brief.scopeSummary)}</p>
<div class="g">${cols
    .map((c, i) => `<section class="col"><h2>${c}</h2>${i === 0 ? cards : '<div class="c"><span>Kéo thả mục vào đây</span></div>'}</section>`)
    .join('')}</div>
<span class="btn">Gửi thông báo Telegram</span></main></body></html>`;
}
