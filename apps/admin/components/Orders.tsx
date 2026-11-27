'use client';

import { useState } from 'react';
import { MAX_ORDER_VND, disputeCoderShare, menuItemOf, orderCapMessage, payoutOf, type AdminOrder, type AdminOrderList } from '@grabcode/contracts/schemas';
import { api, vnd, when } from '../lib/api';
import { Chip, Table, Toolbar, loadingOf, useList } from './ui';
import OrderDetail from './OrderDetail';

/** Server cancels DRAFT and unassigned FUNDED/DISPATCHED orders on refund; the list only shows unassigned ones for those. */
const cancels = (o: AdminOrder) => ['DRAFT', 'FUNDED', 'DISPATCHED'].includes(o.status);

type Tone = 'warn' | 'info' | 'progress' | 'success' | 'danger' | 'neutral';
/** Vietnamese status label + tone (raw code is still shown next to it in the list). */
export function statusOf(o: Pick<AdminOrder, 'status' | 'priceQuotedAt'>): { label: string; tone: Tone } {
  switch (o.status) {
    case 'DRAFT': return o.priceQuotedAt ? { label: 'Chờ khách CK', tone: 'warn' } : { label: 'Chờ báo giá', tone: 'warn' };
    case 'FUNDED': return { label: 'Đã nhận tiền', tone: 'info' };
    case 'DISPATCHED': return { label: 'Đang tìm coder', tone: 'info' };
    case 'IN_PROGRESS': return { label: 'Đang làm', tone: 'progress' };
    case 'DELIVERED': return { label: 'Đã bàn giao', tone: 'warn' };
    case 'ACCEPTED': return { label: 'Hoàn tất', tone: 'success' };
    case 'DISPUTED': return { label: 'Tranh chấp', tone: 'danger' };
    case 'RESOLVED': return { label: 'Đã xử lý TC', tone: 'neutral' };
    case 'CANCELLED': return { label: 'Đã huỷ', tone: 'neutral' };
    default: return { label: o.status, tone: 'neutral' };
  }
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-stone-200 p-3">
      <p className="text-xs font-semibold text-stone-600">{title}</p>
      {children}
    </div>
  );
}

export default function Orders() {
  const [view, setView] = useState<'attention' | 'all'>('attention');
  const { data, error, busy, act } = useList<AdminOrderList>(`/v1/admin/orders?view=${view}`);
  const [refund, setRefund] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<Record<string, { amount: string; ref: string }>>({});
  const [quote, setQuote] = useState<Record<string, { price: string; days: string }>>({});
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
  // Q3: the final price + days of a DRAFT; the customer only sees the transfer QR after this.
  const sendQuote = (o: AdminOrder) => {
    const q = quote[o.id] ?? { price: '', days: '' };
    const priceVnd = Number(q.price);
    const etaDays = Number(q.days || Math.ceil(o.etaHours / 24));
    if (!Number.isInteger(priceVnd) || priceVnd < 100_000 || priceVnd % 1000 !== 0) return alert('Nhập giá chốt (VND, tròn nghìn, từ 100.000).');
    if (priceVnd > MAX_ORDER_VND) return alert(orderCapMessage());
    if (priceVnd < o.paidVnd) return alert(`Khách đã chuyển ${vnd(o.paidVnd)}: giá chốt không được thấp hơn.`);
    if (!Number.isInteger(etaDays) || etaDays < 1 || etaDays > 120) return alert('Nhập số ngày giao (1–120).');
    if (confirm(`Báo giá ${o.id}: ${vnd(priceVnd)}, giao trong ${etaDays} ngày (freelancer nhận ${vnd(payoutOf(priceVnd))}). Khách sẽ thấy giá này và mã QR.`))
      void act(() => api(`/v1/admin/orders/${o.id}/quote`, 'POST', { priceVnd, etaDays }));
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
      <Toolbar>
        <button className={`btn-compact ${view === 'attention' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('attention')}>Cần xử lý</button>
        <button className={`btn-compact ${view === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('all')}>Tất cả đơn</button>
        <span className="text-sm text-stone-600">Đơn DRAFT: báo giá trước, rồi chờ khách chuyển khoản. Nội dung CK đúng là mã đơn bỏ gạch (VD GC1006).</span>
      </Toolbar>
      <Table head={['Đơn', 'Trạng thái', 'Tiền', 'Cần làm']} empty="Không có đơn cần xử lý." error={error} loading={loadingOf(data, error)}>
        {(data?.orders ?? []).map((o) => {
          const st = statusOf(o);
          const reported = o.status === 'DRAFT' && !!o.paymentReportedAt;
          const refundRaw = refund[o.id]?.trim() ?? '';
          const refundN = Number(refundRaw);
          const refundOk = refundRaw !== '' && Number.isInteger(refundN) && refundN >= 0 && refundN <= o.escrowVnd;
          const coderShare = refundOk ? disputeCoderShare(o.escrowVnd, refundN, o.priceVnd, o.payoutVnd) : 0;
          const qPrice = Number(quote[o.id]?.price ?? '');
          const qOk = Number.isInteger(qPrice) && qPrice >= 100_000 && qPrice <= MAX_ORDER_VND && qPrice % 1000 === 0;
          return (
            <tr key={o.id} className={reported ? 'bg-amber-50' : undefined}>
              <td>
                <button className="font-bold text-blue-700 underline" onClick={() => setDetail(o.id)} aria-label={`Xem chi tiết đơn ${o.id}`}>
                  {o.id}
                </button>{' '}
                {o.title}
                <div className="text-xs text-stone-600">
                  {menuItemOf(o.menuItem)?.name && `${menuItemOf(o.menuItem)?.name} · `}
                  {o.customerName}
                  {o.customerEmail && ` (${o.customerEmail})`}
                  {o.customerPhone && ` · ${o.customerPhone}`}
                  {o.coderName && ` → ${o.coderName}`} · tạo {when(o.createdAt)}
                  {o.fundedAt && ` · đủ tiền ${when(o.fundedAt)}`}
                </div>
                {o.disputeReason && <div className="mt-1 text-xs text-red-700">Lý do: {o.disputeReason}</div>}
                {reported && o.paymentReportedAt && (
                  <div className="banner-warn mt-2 !p-3">
                    <span className="material-symbols-outlined" aria-hidden>notifications_active</span>
                    <p className="font-semibold">Khách báo đã chuyển khoản lúc {when(o.paymentReportedAt)} — kiểm tra app ngân hàng</p>
                  </div>
                )}
              </td>
              <td>
                <Chip tone={st.tone}>{st.label}</Chip>
                <div className="mt-1 font-mono text-xs text-stone-600">{o.status}</div>
              </td>
              <td className="tabular-nums">
                <div>{o.priceQuotedAt ? <b>{vnd(o.priceVnd)}</b> : <Chip tone="warn">Chưa báo giá</Chip>}</div>
                <div className="mt-1 text-xs text-stone-600">
                  {o.priceQuotedAt ? 'Giá chốt' : `Giá từ ${vnd(o.priceVnd)}`} · Đã nạp {vnd(o.paidVnd)}
                </div>
                <div className="text-xs text-stone-600">Escrow {vnd(o.escrowVnd)}</div>
              </td>
              <td>
                {o.status === 'DISPUTED' ? (
                  <Block title="Chốt tranh chấp">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={o.escrowVnd}
                        step={1000}
                        className="min-h-[36px] w-40 px-2"
                        aria-label={`Số tiền hoàn cho khách đơn ${o.id}`}
                        placeholder="Hoàn khách (bắt buộc)"
                        required
                        value={refund[o.id] ?? ''}
                        onChange={(e) => setRefund({ ...refund, [o.id]: e.target.value })}
                      />
                      <button className="btn-danger btn-compact" disabled={busy} onClick={() => resolve(o)}>
                        Chốt chia tiền
                      </button>
                    </div>
                    {refundOk && (
                      <p className="text-sm tabular-nums" aria-live="polite">
                        Khách nhận <b>{vnd(refundN)}</b> · Coder nhận <b>{vnd(coderShare)}</b> · Phí nền tảng <b>{vnd(o.escrowVnd - refundN - coderShare)}</b>
                      </p>
                    )}
                  </Block>
                ) : (
                  <div className="flex flex-col gap-2">
                    {o.status === 'DRAFT' && (
                      <Block title="Báo giá">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={100_000}
                            max={MAX_ORDER_VND}
                            step={1000}
                            className="min-h-[36px] w-36 px-2"
                            aria-label={`Giá chốt cho đơn ${o.id}`}
                            placeholder={o.priceQuotedAt ? `Giá mới (${o.priceVnd})` : `Giá chốt (từ ${o.priceVnd})`}
                            value={quote[o.id]?.price ?? ''}
                            onChange={(e) => setQuote({ ...quote, [o.id]: { days: quote[o.id]?.days ?? '', price: e.target.value } })}
                          />
                          <input
                            type="number"
                            min={1}
                            max={120}
                            className="min-h-[36px] w-28 px-2"
                            aria-label={`Số ngày giao của đơn ${o.id}`}
                            placeholder={`${Math.ceil(o.etaHours / 24)} ngày`}
                            value={quote[o.id]?.days ?? ''}
                            onChange={(e) => setQuote({ ...quote, [o.id]: { price: quote[o.id]?.price ?? '', days: e.target.value } })}
                          />
                          <button className={`btn-compact ${o.priceQuotedAt ? 'btn-outline' : 'btn-primary'}`} disabled={busy} onClick={() => sendQuote(o)}>
                            {o.priceQuotedAt ? 'Báo giá lại' : 'Báo giá'}
                          </button>
                        </div>
                        <p className="text-xs text-stone-600">Trần mỗi đơn {vnd(MAX_ORDER_VND)}.{qOk && ` Freelancer nhận ${vnd(payoutOf(qPrice))}.`}</p>
                      </Block>
                    )}
                    {o.status === 'DRAFT' && (
                      <Block title="Xác nhận đã nhận tiền">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1000}
                            step={1000}
                            className="min-h-[36px] w-40 px-2"
                            aria-label={`Số tiền đã nhận cho đơn ${o.id}`}
                            placeholder="Số tiền đã nhận"
                            required
                            value={paid[o.id]?.amount ?? ''}
                            onChange={(e) => setPaid({ ...paid, [o.id]: { ref: paid[o.id]?.ref ?? '', amount: e.target.value } })}
                          />
                          <input
                            className="min-h-[36px] w-36 px-2"
                            aria-label={`Mã giao dịch ngân hàng của đơn ${o.id}`}
                            placeholder="Mã GD (FT...)"
                            value={paid[o.id]?.ref ?? ''}
                            onChange={(e) => setPaid({ ...paid, [o.id]: { amount: paid[o.id]?.amount ?? '', ref: e.target.value } })}
                          />
                          <button className="btn-primary btn-compact" disabled={busy} onClick={() => confirmPaid(o)}>
                            Xác nhận đã nhận tiền
                          </button>
                        </div>
                        <p className="text-xs text-stone-600">Nhập đúng số trong app ngân hàng. Còn thiếu {vnd(due(o))}.</p>
                      </Block>
                    )}
                    {(o.escrowVnd > 0 || cancels(o)) && (
                      <button className="btn-outline btn-compact self-start !text-red-700" disabled={busy} onClick={() => refundAll(o)}>
                        {cancels(o) ? 'Hoàn & huỷ đơn' : 'Hoàn tiền thừa'}
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {detail && <OrderDetail id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
