'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AdminCoder, AdminCoderList, AdminOrder, AdminOrderList, Me, Monitor, Payout, PayoutList, SuspenseItem, SuspenseList } from '@grabcode/contracts/schemas';
import { ApiError, api, vnd, when } from '../lib/api';

const TABS = { coders: 'Coder', orders: 'Đơn hàng & thanh toán', suspense: 'Đối soát suspense', payouts: 'Rút tiền', monitor: 'Worker / Queue' } as const;
type Tab = keyof typeof TABS;
const TIERS: NonNullable<AdminCoder['tierOverride']>[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];

export default function AdminPage() {
  const [me, setMe] = useState<Me | null | 'denied'>(null);
  const [tab, setTab] = useState<Tab>('orders');

  useEffect(() => {
    api<Me>('/v1/me')
      .then((m) => setMe(m.roles.includes('ADMIN') ? m : 'denied'))
      .catch((e) => {
        // Single login page lives in the web app (same origin through the /admin rewrite).
        if (e instanceof ApiError && e.status === 401) window.location.assign(`/login?next=${encodeURIComponent('/admin')}`);
        else setMe('denied');
      });
  }, []);

  if (me === null) return <p className="p-8 text-sm text-slate-500" role="status">Đang kiểm tra đăng nhập…</p>;
  if (me === 'denied') return <p className="p-8 text-sm text-red-700" role="alert">Tài khoản không có quyền ADMIN (hoặc core-api không chạy).</p>;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">GrabCode Admin</h1>
        <span className="text-sm text-slate-500">{me.email ?? me.githubLogin ?? me.name}</span>
      </header>
      <nav className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? 'btn' : 'btn-alt'}>
            {TABS[t]}
          </button>
        ))}
      </nav>
      {tab === 'coders' && <Coders />}
      {tab === 'orders' && <Orders />}
      {tab === 'suspense' && <Suspense />}
      {tab === 'payouts' && <Payouts />}
      {tab === 'monitor' && <MonitorView />}
    </main>
  );
}

/** Loads `path`, renders a table; `act` runs a mutation then reloads, showing the API error inline. */
function useList<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<T>(path).then(setData, (e: Error) => setError(e.message)), [path]);
  useEffect(() => void load(), [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { data, error, busy, act, load };
}

function Table({ head, children, empty, error }: { head: string[]; children: ReactNode[]; empty: string; error: string | null }) {
  return (
    <section className="overflow-x-auto rounded border border-slate-200 bg-white">
      {error && <p className="bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <table className="w-full">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {children.length === 0 && <p className="p-4 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

function Coders() {
  const { data, error, busy, act } = useList<AdminCoderList>('/v1/admin/coders');
  const patch = (c: AdminCoder, body: object) => act(() => api(`/v1/admin/coders/${c.id}`, 'PATCH', body));
  return (
    <Table head={['Coder', 'Tier', 'Đơn xong', 'Ví', 'Trạng thái', '']} empty="Chưa có coder." error={error}>
      {(data?.coders ?? []).map((c) => (
        <tr key={c.id}>
          <td>
            {c.name}
            <div className="text-xs text-slate-500">{c.githubLogin ?? c.email}</div>
          </td>
          <td>
            <select
              aria-label={`Tier của ${c.name}`}
              value={c.tierOverride ?? ''}
              disabled={busy}
              onChange={(e) => patch(c, { tierOverride: e.target.value || null })}
            >
              <option value="">Tự động{c.tierOverride ? '' : ` (${c.tier})`}</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </td>
          <td>{c.completedOrders}</td>
          <td>{vnd(c.balanceVnd)}</td>
          <td>{c.suspended ? <b className="text-red-700">Đã khoá</b> : c.online ? 'Online' : 'Offline'}</td>
          <td>
            <button className="btn-alt" disabled={busy} onClick={() => patch(c, { suspended: !c.suspended })}>
              {c.suspended ? 'Mở khoá' : 'Khoá'}
            </button>
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Server cancels DRAFT and unassigned FUNDED/DISPATCHED orders on refund; the list only shows unassigned ones for those. */
const cancels = (o: AdminOrder) => ['DRAFT', 'FUNDED', 'DISPATCHED'].includes(o.status);

function Orders() {
  const [view, setView] = useState<'attention' | 'all'>('attention');
  const { data, error, busy, act } = useList<AdminOrderList>(`/v1/admin/orders?view=${view}`);
  const [refund, setRefund] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<Record<string, { amount: string; ref: string }>>({});
  const due = (o: AdminOrder) => Math.max(0, o.priceVnd - o.paidVnd);
  const confirmPaid = (o: AdminOrder) => {
    const p = paid[o.id] ?? { amount: '', ref: '' };
    const amountVnd = Number(p.amount || due(o));
    if (!p.ref.trim()) return alert('Nhập mã giao dịch ngân hàng (để tránh ghi nhận trùng).');
    if (confirm(`Xác nhận đã NHẬN ${vnd(amountVnd)} cho ${o.id} (mã GD ${p.ref})? Kiểm tra app ngân hàng trước khi bấm.`))
      void act(() => api(`/v1/admin/orders/${o.id}/confirm-payment`, 'POST', { amountVnd, reference: p.ref }));
  };
  const resolve = (o: AdminOrder) =>
    act(() => api(`/v1/admin/orders/${o.id}/resolve`, 'POST', { refundVnd: Number(refund[o.id] ?? 0) }));
  const refundAll = (o: AdminOrder) => {
    if (confirm(`Hoàn ${vnd(o.escrowVnd)} cho khách của ${o.id}?${cancels(o) ? ' Đơn sẽ bị huỷ.' : ''}`))
      void act(() => api(`/v1/admin/orders/${o.id}/refund`, 'POST'));
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button className={view === 'attention' ? 'btn' : 'btn-alt'} onClick={() => setView('attention')}>Cần xử lý</button>
        <button className={view === 'all' ? 'btn' : 'btn-alt'} onClick={() => setView('all')}>Tất cả đơn</button>
        <span className="text-slate-500">Đơn DRAFT = chờ khách chuyển khoản. Nội dung CK đúng là mã đơn bỏ gạch (VD GC1006).</span>
      </div>
      <Table head={['Đơn', 'Trạng thái', 'Giá / đã nạp', 'Escrow', 'Xử lý']} empty="Không có đơn cần xử lý." error={error}>
        {(data?.orders ?? []).map((o) => (
          <tr key={o.id}>
            <td>
              <b>{o.id}</b> {o.title}
              <div className="text-xs text-slate-500">
                {o.customerName}
                {o.customerEmail && ` (${o.customerEmail})`}
                {o.coderName && ` → ${o.coderName}`} · tạo {when(o.createdAt)}
              </div>
              {o.disputeReason && <div className="mt-1 text-xs text-red-700">Lý do: {o.disputeReason}</div>}
            </td>
            <td>{o.status}</td>
            <td>
              {vnd(o.priceVnd)}
              <div className="text-xs text-slate-500">{vnd(o.paidVnd)}</div>
            </td>
            <td>{vnd(o.escrowVnd)}</td>
            <td>
              {o.status === 'DISPUTED' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={o.escrowVnd}
                    step={1000}
                    className="w-32"
                    aria-label={`Số tiền hoàn cho khách đơn ${o.id}`}
                    placeholder="Hoàn cho khách"
                    value={refund[o.id] ?? ''}
                    onChange={(e) => setRefund({ ...refund, [o.id]: e.target.value })}
                  />
                  <button className="btn" disabled={busy} onClick={() => resolve(o)}>
                    Chốt (còn lại trả coder)
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {o.status === 'DRAFT' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        className="w-32"
                        aria-label={`Số tiền đã nhận cho đơn ${o.id}`}
                        placeholder={String(due(o))}
                        value={paid[o.id]?.amount ?? ''}
                        onChange={(e) => setPaid({ ...paid, [o.id]: { ref: paid[o.id]?.ref ?? '', amount: e.target.value } })}
                      />
                      <input
                        className="w-32"
                        aria-label={`Mã giao dịch ngân hàng của đơn ${o.id}`}
                        placeholder="Mã GD (FT...)"
                        value={paid[o.id]?.ref ?? ''}
                        onChange={(e) => setPaid({ ...paid, [o.id]: { amount: paid[o.id]?.amount ?? '', ref: e.target.value } })}
                      />
                      <button className="btn" disabled={busy} onClick={() => confirmPaid(o)}>
                        Xác nhận đã nhận tiền
                      </button>
                    </div>
                  )}
                  {(o.escrowVnd > 0 || cancels(o)) && (
                    <button className="btn-alt self-start" disabled={busy} onClick={() => refundAll(o)}>
                      {cancels(o) ? 'Hoàn & huỷ đơn' : 'Hoàn tiền thừa'}
                    </button>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Suspense() {
  const { data, error, busy, act } = useList<SuspenseList>('/v1/admin/suspense');
  const [target, setTarget] = useState<Record<string, string>>({});
  const resolve = (i: SuspenseItem, orderId: string | null) =>
    act(() => api(`/v1/admin/suspense/${encodeURIComponent(i.txId)}/resolve`, 'POST', { orderId }));
  return (
    <Table head={['Giao dịch', 'Số tiền', 'Nội dung CK', 'Xử lý']} empty="Không có giao dịch treo." error={error}>
      {(data?.items ?? []).map((i) => (
        <tr key={i.txId}>
          <td>
            {i.txId}
            <div className="text-xs text-slate-500">{when(i.createdAt)}</div>
          </td>
          <td>{vnd(i.amountVnd)}</td>
          <td className="max-w-xs break-words">{i.content}</td>
          <td>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-28"
                placeholder="GC-1234"
                aria-label={`Mã đơn nhận tiền của ${i.txId}`}
                value={target[i.txId] ?? ''}
                onChange={(e) => setTarget({ ...target, [i.txId]: e.target.value.trim().toUpperCase() })}
              />
              <button className="btn" disabled={busy || !target[i.txId]} onClick={() => resolve(i, target[i.txId])}>
                Gán vào đơn
              </button>
              <button className="btn-alt" disabled={busy} onClick={() => confirm(`Hoàn ${vnd(i.amountVnd)} cho người chuyển?`) && resolve(i, null)}>
                Hoàn lại
              </button>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Payouts() {
  const { data, error, busy, act } = useList<PayoutList>('/v1/admin/payouts');
  const decide = (p: Payout, approve: boolean) => {
    const note = approve ? undefined : (prompt('Lý do từ chối?') ?? undefined);
    if (approve && !confirm(`Đã chuyển ${vnd(p.amountVnd)} tới "${p.bankAccount}"? Ví coder sẽ bị trừ.`)) return;
    void act(() => api(`/v1/admin/payouts/${p.id}/decide`, 'POST', { approve, note }));
  };
  return (
    <Table head={['Coder', 'Số tiền', 'Tài khoản nhận', 'Trạng thái', '']} empty="Chưa có yêu cầu rút tiền." error={error}>
      {(data?.payouts ?? []).map((p) => (
        <tr key={p.id}>
          <td>
            {p.coderName}
            <div className="text-xs text-slate-500">{when(p.createdAt)}</div>
          </td>
          <td>{vnd(p.amountVnd)}</td>
          <td>{p.bankAccount}</td>
          <td>
            {p.status}
            {p.note && <div className="text-xs text-slate-500">{p.note}</div>}
          </td>
          <td>
            {p.status === 'PENDING' && (
              <div className="flex gap-2">
                <button className="btn" disabled={busy} onClick={() => decide(p, true)}>Đã chuyển</button>
                <button className="btn-alt" disabled={busy} onClick={() => decide(p, false)}>Từ chối</button>
              </div>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function MonitorView() {
  const { data, error, busy, act, load } = useList<Monitor>('/v1/admin/monitor');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 rounded border border-slate-200 bg-white p-4 text-sm">
        <span>Outbox chờ relay: <b>{data?.outboxPending ?? '…'}</b>{data?.outboxOldestSeconds != null && ` (cũ nhất ${data.outboxOldestSeconds}s)`}</span>
        <span>Realtime chờ Centrifugo: <b>{data?.realtimePending ?? '…'}</b></span>
        <button className="btn-alt" onClick={() => void load()}>Làm mới</button>
      </div>
      <Table head={['Consumer JetStream', 'Pending', 'Ack pending', 'Redelivered']} empty={data?.consumers === null ? 'Không kết nối được NATS.' : 'Không có consumer.'} error={null}>
        {(data?.consumers ?? []).map((c) => (
          <tr key={c.name}>
            <td>{c.name}</td>
            <td>{c.pending}</td>
            <td>{c.ackPending}</td>
            <td>{c.redelivered}</td>
          </tr>
        ))}
      </Table>
      <Table head={['Job lỗi', 'Đơn', 'Lỗi', '']} empty="Không có job FAILED." error={error}>
        {(data?.failedJobs ?? []).map((j) => (
          <tr key={`${j.kind}:${j.id}`}>
            <td>
              {j.kind}
              <div className="text-xs text-slate-500">{when(j.updatedAt)}</div>
            </td>
            <td>{j.orderId ?? '—'}</td>
            <td className="max-w-md break-words text-xs">{j.error}</td>
            <td>
              {j.retryable && (
                <button className="btn" disabled={busy} onClick={() => act(() => api(`/v1/admin/jobs/${j.kind}/${j.orderId}/retry`, 'POST'))}>
                  Thử lại
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
