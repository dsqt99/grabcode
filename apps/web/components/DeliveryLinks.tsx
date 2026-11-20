import type { Order } from '@grabcode/contracts';

/**
 * Real orders without a ready preview (UX P0-5): the links the freelancer handed in per milestone, never a generated
 * demo page or a made-up preview URL.
 */
export default function DeliveryLinks({ order }: { order: Order }) {
  const links = order.brief.milestones.filter((m) => m.deliveryUrl);
  return (
    <section aria-labelledby="delivery-title" className="card space-y-3 shadow-l2">
      <h2 id="delivery-title" className="font-display text-lg font-bold text-ink">Bàn giao</h2>
      {order.sandboxStatus === 'PENDING' && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900" role="status">Đang dựng bản chạy thử… thường mất vài phút.</p>
      )}
      {links.length === 0 ? (
        <p className="text-sm text-slate-600">Freelancer chưa gửi link bàn giao.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {links.map((m) => (
              <li key={m.id} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {m.id} · {m.title}
                  </p>
                  <p className="truncate text-xs text-slate-600">{m.deliveryUrl}</p>
                </div>
                <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary min-h-[44px] shrink-0 !px-4 !py-2 text-sm">
                  Mở link
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-600">Link do freelancer cung cấp, mở ở tab mới.</p>
        </>
      )}
    </section>
  );
}
