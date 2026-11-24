import type { Order } from '@grabcode/contracts';

/**
 * Real orders without a ready preview (UX P0-5): the links the freelancer handed in per milestone, never a generated
 * demo page or a made-up preview URL.
 */
export default function DeliveryLinks({ order }: { order: Order }) {
  const links = order.brief.milestones.filter((m) => m.deliveryUrl);
  return (
    <section aria-labelledby="delivery-title" className="space-y-3">
      <h2 id="delivery-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
        <span className="material-symbols-outlined text-brand-700" aria-hidden>inventory_2</span>
        Bàn giao
      </h2>
      {order.sandboxStatus === 'PENDING' && (
        <p className="banner-info" role="status">Đang dựng bản chạy thử… thường mất vài phút.</p>
      )}
      {links.length === 0 ? (
        <p className="text-sm text-stone-600">Freelancer chưa gửi link bàn giao.</p>
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {links.map((m) => (
              <li key={m.id} className="flex min-h-[48px] items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">
                    {m.id} · {m.title}
                  </p>
                  <p className="truncate text-xs text-stone-600">{m.deliveryUrl}</p>
                </div>
                <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-outline btn-sm shrink-0">
                  Mở link
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-600">Link do freelancer cung cấp, mở ở tab mới.</p>
        </>
      )}
    </section>
  );
}
