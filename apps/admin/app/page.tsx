'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  disputeCoderShare,
  type AdminCoder,
  type AdminCoderList,
  type AdminOrder,
  type AdminOrderDetail,
  type AdminOrderList,
  type Me,
  type Monitor,
  type Payout,
  type PayoutList,
  type Refund,
  type RefundList,
  type SuspenseItem,
  type SuspenseList,
} from '@grabcode/contracts/schemas';
import { ApiError, api, vnd, when } from '../lib/api';

const TABS = { coders: 'Coder', orders: 'Đơn hàng & thanh toán', refunds: 'Chờ chuyển trả', suspense: 'Đối soát suspense', payouts: 'Rút tiền', monitor: 'Worker / Queue' } as const;
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
      {tab === 'refunds' && <Refunds />}
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
    // No default amount: the admin types what the bank app shows (a short transfer must not be booked as paid in full).
    const amountVnd = Number(p.amount);
    if (!Number.isInteger(amountVnd) || amountVnd < 1000) return alert('Nhập số tiền đã nhận đúng như trong app ngân hàng.');
    if (!p.ref.trim()) return alert('Nhập mã giao dịch ngân hàng (để tránh ghi nhận trùng).');
    if (confirm(`Xác nhận đã NHẬN ${vnd(amountVnd)} cho ${o.id} (mã GD ${p.ref})? Kiểm tra app ngân hàng trước khi bấm.`))
      void act(() => api(`/v1/admin/orders/${o.id}/confirm-payment`, 'POST', { amountVnd, reference: p.ref }));
  };
  const [detail, setDetail] = useState<string | null>(null);
  // Refund amount is required (empty used to mean 0 = the whole escrow to the coder); the confirm states both sides.
  const resolve = (o: AdminOrder) => {
    const raw = refund[o.id]?.trim() ?? '';
    const refundVnd = Number(raw);
    if (raw === '' || !Number.isInteger(refundVnd) || refundVnd < 0 || refundVnd > o.escrowVnd)
      return alert(`Nhập số tiền hoàn cho khách, từ 0 đến ${vnd(o.escrowVnd)} (nhập 0 nếu không hoàn).`);
    const coder = disputeCoderShare(o.escrowVnd, refundVnd, o.priceVnd, o.payoutVnd);
    const fee = o.escrowVnd - refundVnd - coder;
    if (confirm(`Chốt tranh chấp ${o.id}: Hoàn ${vnd(refundVnd)} cho khách, trả ${vnd(coder)} cho coder${fee > 0 ? ` (phí nền tảng ${vnd(fee)})` : ''}. Không hoàn tác được.`))
      void act(() => api(`/v1/admin/orders/${o.id}/resolve`, 'POST', { refundVnd }));
  };
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
              <button className="font-bold text-blue-700 underline" onClick={() => setDetail(o.id)} aria-label={`Xem chi tiết đơn ${o.id}`}>
                {o.id}
              </button>{' '}
              {o.title}
              <div className="text-xs text-slate-500">
                {o.customerName}
                {o.customerEmail && ` (${o.customerEmail})`}
                {o.coderName && ` → ${o.coderName}`} · tạo {when(o.createdAt)}
                {o.fundedAt && ` · đủ tiền ${when(o.fundedAt)}`}
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
                    placeholder="Hoàn khách (bắt buộc)"
                    required
                    value={refund[o.id] ?? ''}
                    onChange={(e) => setRefund({ ...refund, [o.id]: e.target.value })}
                  />
                  <button className="btn" disabled={busy} onClick={() => resolve(o)}>
                    Chốt chia tiền
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
                        placeholder={`Đã nhận (còn thiếu ${due(o)})`}
                        required
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
      {detail && <OrderDetail id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Read only (P0-10): prompt, brief + milestones, dispute reason, refund account, chat and ledger of one order. */
function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => void api<AdminOrderDetail>(`/v1/admin/orders/${encodeURIComponent(id)}`).then(setD, (e: Error) => setError(e.message)), [id]);
  return (
    <section className="mt-4 space-y-4 rounded border border-slate-300 bg-white p-4 text-sm" aria-label={`Chi tiết đơn ${id}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Chi tiết đơn {id} (chỉ đọc)</h2>
        <button className="btn-alt" onClick={onClose}>Đóng</button>
      </div>
      {error && <p className="bg-red-50 p-3 text-red-700" role="alert">{error}</p>}
      {!d && !error && <p className="text-slate-500">Đang tải…</p>}
      {d && (
        <>
          <p>
            <b>{d.order.status}</b> · giá {vnd(d.order.priceVnd)} · đã nạp {vnd(d.order.paidVnd)} · escrow {vnd(d.order.escrowVnd)} · khách {d.order.customerName}
            {d.order.customerEmail && ` (${d.order.customerEmail})`}
            {d.order.coderName && ` · coder ${d.order.coderName}`}
          </p>
          {d.order.disputeReason && <p className="text-red-700">Lý do tranh chấp: {d.order.disputeReason}</p>}
          <p>
            STK nhận hoàn:{' '}
            {d.refundAccount ? `${d.refundAccount.bankName} · ${d.refundAccount.accountNumber} · ${d.refundAccount.accountName}` : <i>khách chưa nhập</i>}
          </p>
          <div>
            <h3 className="font-bold">Yêu cầu của khách</h3>
            <p className="whitespace-pre-wrap">{d.prompt}</p>
          </div>
          <div>
            <h3 className="font-bold">Đặc tả: {d.brief.title}</h3>
            <p className="whitespace-pre-wrap text-slate-600">{d.brief.scopeSummary}</p>
          </div>
          <Table head={['Mốc', 'Trạng thái', 'Bàn giao', 'Ghi chú', 'Nộp / duyệt']} empty="Không có mốc." error={null}>
            {d.brief.milestones.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.id} · {m.title} ({m.weightPercent}%)
                </td>
                <td>{m.status}</td>
                <td className="max-w-xs break-all">
                  {m.deliveryUrl ? (
                    <a className="text-blue-700 underline" href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow">
                      {m.deliveryUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                  {m.commitHash && <div className="font-mono text-xs">{m.commitHash}</div>}
                </td>
                <td className="max-w-xs break-words">{m.note ?? '—'}</td>
                <td className="text-xs">
                  {m.submittedAt ? when(m.submittedAt) : '—'}
                  <br />
                  {m.completedAt ? when(m.completedAt) : '—'}
                </td>
              </tr>
            ))}
          </Table>
          <Table head={['Chat', 'Nội dung', 'Lúc']} empty="Chưa có tin nhắn." error={null}>
            {d.messages.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.senderName} ({m.sender === 'CUSTOMER' ? 'khách' : 'coder'})
                </td>
                <td className="max-w-md whitespace-pre-wrap break-words">{m.text}</td>
                <td className="text-xs">{when(m.timestamp)}</td>
              </tr>
            ))}
          </Table>
          <Table head={['Sổ cái', 'Loại', 'Bút toán', 'Mã GD / ghi chú', 'Lúc']} empty="Chưa có giao dịch." error={null}>
            {d.ledger.map((t) => (
              <tr key={t.txId}>
                <td className="font-mono text-xs">{t.txId}</td>
                <td>{t.kind}</td>
                <td className="text-xs">
                  {t.entries.map((e) => (
                    <div key={e.account}>
                      {e.account}: {vnd(e.amountVnd)}
                    </div>
                  ))}
                </td>
                <td>{t.reference ?? '—'}</td>
                <td className="text-xs">{when(t.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

/** B2: every refund booked in the ledger waits here until the admin has really transferred it back. */
function Refunds() {
  const [view, setView] = useState<'PENDING' | 'all'>('PENDING');
  const { data, error, busy, act } = useList<RefundList>(`/v1/admin/refunds?status=${view}`);
  const [ref, setRef] = useState<Record<string, string>>({});
  const paid = (r: Refund) => {
    const reference = ref[r.id]?.trim();
    if (!reference) return alert('Nhập mã giao dịch chuyển trả (để tránh ghi trùng).');
    const to = r.refundAccount ? `${r.refundAccount.bankName} ${r.refundAccount.accountNumber} (${r.refundAccount.accountName})` : 'người chuyển';
    if (confirm(`Đã chuyển ${vnd(r.amountVnd)} tới ${to}, mã GD ${reference}?`)) void act(() => api(`/v1/admin/refunds/${r.id}/paid`, 'POST', { reference }));
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button className={view === 'PENDING' ? 'btn' : 'btn-alt'} onClick={() => setView('PENDING')}>Chờ chuyển trả</button>
        <button className={view === 'all' ? 'btn' : 'btn-alt'} onClick={() => setView('all')}>Tất cả</button>
        <span className="text-slate-500">Hoàn tiền trong hệ thống chỉ là ghi sổ: chuyển khoản tay cho khách rồi bấm &quot;Đã chuyển&quot;.</span>
      </div>
      <Table head={['Đơn', 'Số tiền', 'Chuyển tới', 'Lúc ghi sổ', 'Xử lý']} empty="Không có khoản chờ chuyển trả." error={error}>
        {(data?.refunds ?? []).map((r) => (
          <tr key={r.id}>
            <td>
              <b>{r.orderId ?? 'Suspense'}</b>
              <div className="text-xs text-slate-500">
                {r.customerName}
                {r.customerEmail && ` (${r.customerEmail})`}
              </div>
            </td>
            <td>{vnd(r.amountVnd)}</td>
            <td>
              {r.refundAccount ? (
                <>
                  {r.refundAccount.bankName} · <span className="font-mono">{r.refundAccount.accountNumber}</span>
                  <div className="text-xs">{r.refundAccount.accountName}</div>
                </>
              ) : r.transferContent !== null ? (
                <span className="text-xs">Người chuyển nội dung &quot;{r.transferContent}&quot; (tra sao kê)</span>
              ) : (
                <b className="text-amber-700">Khách chưa nhập STK, liên hệ khách</b>
              )}
            </td>
            <td className="text-xs">{when(r.createdAt)}</td>
            <td>
              {r.status === 'PAID' ? (
                <span className="text-xs">
                  Đã chuyển · {r.reference}
                  {r.paidAt && <div>{when(r.paidAt)}</div>}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="w-32"
                    aria-label={`Mã giao dịch chuyển trả của ${r.orderId ?? r.txId}`}
                    placeholder="Mã GD (FT...)"
                    value={ref[r.id] ?? ''}
                    onChange={(e) => setRef({ ...ref, [r.id]: e.target.value })}
                  />
                  <button className="btn" disabled={busy} onClick={() => paid(r)}>
                    Đã chuyển
                  </button>
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
