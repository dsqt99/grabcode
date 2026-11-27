'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toViewOrder, type Order } from '@grabcode/contracts';
import { useAuth } from '@grabcode/auth-ui';
import Navbar from '../../components/Navbar';
import StatusChip from '../../components/StatusChip';
import { listOrders, ordersApiEnabled } from '../../lib/api';
import { ORDER_TABS, customerTodo, dayMonth, orderTab, statusInput, statusView, type OrderTab } from '../../lib/orderStatus';
import { loadOrders } from '../../lib/orderStore';
import { formatVnd } from '../../lib/pricing';

interface Row {
  order: Order;
  /** Newest activity first (server updatedAt; createdAt for local demo orders). */
  sortKey: string;
}

/** "Đơn của tôi" (UX spec HON-18 Màn D, BA P0-6): the customer finds every order again, with what they must do next. */
export default function MyOrdersPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<OrderTab>('action');

  const load = useCallback(() => {
    setFailed(false);
    if (!ordersApiEnabled) {
      setRows(Object.values(loadOrders()).map((order) => ({ order, sortKey: order.createdAt })));
      return;
    }
    if (!me) return;
    listOrders().then(
      // scope=mine also returns orders the user works on as a coder.
      (all) => setRows(all.filter((o) => o.customer.id === me.id).map((o) => ({ order: toViewOrder(o), sortKey: o.updatedAt }))),
      (e) => (console.warn(e), setFailed(true)),
    );
  }, [me]);

  useEffect(load, [load]);

  const byTab = useMemo(() => {
    const groups: Record<OrderTab, { row: Row; todo: string | null }[]> = { action: [], active: [], done: [], cancelled: [] };
    for (const row of [...(rows ?? [])].sort((a, b) => b.sortKey.localeCompare(a.sortKey))) {
      const input = statusInput(row.order);
      groups[orderTab(input)].push({ row, todo: customerTodo(input) });
    }
    return groups;
  }, [rows]);

  // Land on the first tab that has something when the customer has nothing to do.
  useEffect(() => {
    if (rows && byTab.action.length === 0) setTab(ORDER_TABS.find((t) => byTab[t.id].length > 0)?.id ?? 'action');
  }, [rows, byTab]);

  const shown = byTab[tab];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-8 md:py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-stone-900 md:text-3xl">Đơn của tôi</h1>
          <Link href="/#dispatch" className="btn-primary btn-sm">
            <span className="material-symbols-outlined text-[20px]!" aria-hidden>add</span>
            Đặt đơn mới
          </Link>
        </div>

        {failed ? (
          <section className="banner-danger" role="alert">
            <span className="material-symbols-outlined" aria-hidden>error</span>
            <div className="space-y-2">
              <p className="font-semibold">Không tải được danh sách đơn. Kiểm tra kết nối rồi thử lại.</p>
              <button type="button" className="btn-outline btn-sm" onClick={load}>Thử lại</button>
            </div>
          </section>
        ) : !rows ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Đang tải đơn…</span>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
          </div>
        ) : rows.length === 0 ? (
          <section className="card flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-600" aria-hidden>
              <span className="material-symbols-outlined text-[40px]!">receipt_long</span>
            </span>
            <h2 className="font-display text-base font-bold text-stone-900">Bạn chưa có đơn nào</h2>
            <p className="max-w-sm text-sm text-stone-600">Mô tả ý tưởng để nhận đặc tả và báo giá. Bạn chưa phải trả tiền cho tới khi có giá chốt.</p>
            <Link href="/#dispatch" className="btn-primary">Đặt đơn đầu tiên</Link>
          </section>
        ) : (
          <>
            {/* Fade on the right edge (mobile): tells there are more tabs to scroll to. */}
            <div className="relative -mx-4 md:mx-0">
              <div role="tablist" aria-label="Lọc đơn" className="flex gap-2 overflow-x-auto px-4 pb-1 md:px-0">
                {ORDER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`min-h-[44px] shrink-0 rounded-full px-4 font-display text-sm font-semibold ${
                      tab === t.id ? 'bg-ink text-white' : 'bg-white text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {t.label} ({byTab[t.id].length})
                  </button>
                ))}
              </div>
              <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-stone-50 md:hidden" aria-hidden />
            </div>
            {shown.length === 0 ? (
              <p className="card text-center text-sm text-stone-600">Không có đơn ở mục này.</p>
            ) : (
              <ul className="space-y-3">
                {shown.map(({ row: { order }, todo }) => {
                  const sv = statusView(statusInput(order));
                  return (
                    <li key={order.id}>
                      <Link href={`/order/${order.id}`} className="card card-hover block min-h-[96px] overflow-hidden p-4!">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-stone-600">
                            {order.id} · {dayMonth(order.createdAt)}
                          </span>
                          {/* Same words as the to-do strip below (e.g. "Demo đã giao, chờ bạn nhận"): say it once. */}
                          {sv.label !== todo && <StatusChip tone={sv.tone} label={sv.label} />}
                        </div>
                        <p className="mt-1 line-clamp-2 font-display font-bold text-stone-900">{order.title}</p>
                        <p className="mt-0.5 text-sm tabular-nums text-stone-700">{formatVnd(order.priceVnd)}</p>
                        {todo && (
                          <p className="-mx-4 -mb-4 mt-3 flex items-center gap-2 rounded-b-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
                            <span className="material-symbols-outlined text-[20px]!" aria-hidden>arrow_forward</span>
                            {todo}
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
