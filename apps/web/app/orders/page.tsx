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
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-ink">Đơn của tôi</h1>
          <Link href="/#dispatch" className="btn-primary min-h-[44px] !px-4 !py-2 text-sm">+ Đặt đơn mới</Link>
        </div>

        {failed ? (
          <section className="card space-y-3 text-center" role="alert">
            <p className="font-semibold text-red-800">Không tải được danh sách đơn.</p>
            <button type="button" className="btn-secondary" onClick={load}>Thử lại</button>
          </section>
        ) : !rows ? (
          <div className="space-y-3" aria-busy="true" aria-label="Đang tải đơn">
            {[0, 1, 2].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-lg bg-slate-100" />)}
          </div>
        ) : rows.length === 0 ? (
          <section className="card space-y-3 py-10 text-center">
            <p className="font-display text-lg font-bold text-ink">Bạn chưa có đơn nào.</p>
            <p className="text-sm text-slate-600">Mô tả ý tưởng để nhận đặc tả và báo giá.</p>
            <Link href="/#dispatch" className="btn-primary">Đặt đơn đầu tiên</Link>
          </section>
        ) : (
          <>
            <div role="tablist" aria-label="Lọc đơn" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {ORDER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 font-display text-sm font-semibold ${
                    tab === t.id ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-slate-200'
                  }`}
                >
                  {t.label}
                  {t.id === 'action' && ` (${byTab.action.length})`}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="card text-center text-sm text-slate-600">Không có đơn ở mục này.</p>
            ) : (
              <ul className="space-y-3">
                {shown.map(({ row: { order }, todo }) => {
                  const sv = statusView(statusInput(order));
                  return (
                    <li key={order.id}>
                      <Link href={`/order/${order.id}`} className="card card-hover flex min-h-[88px] items-center gap-3 !p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {order.id} · {dayMonth(order.createdAt)}
                            </span>
                            <StatusChip tone={sv.tone} label={sv.label} />
                          </div>
                          <p className="mt-1 line-clamp-1 font-display font-bold text-ink">{order.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            <span className="tabular-nums">{formatVnd(order.priceVnd)}</span>
                            {todo && <span className="font-semibold text-amber-text"> · {todo}</span>}
                          </p>
                        </div>
                        <span className="material-symbols-outlined shrink-0 text-slate-500" aria-hidden>chevron_right</span>
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
