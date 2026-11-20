'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdminOrderDetail } from '@grabcode/contracts/schemas';
import { api, vnd, when } from '../lib/api';
import { Chip, Table } from './ui';
import { statusOf } from './Orders';

/** Read only (P0-10): prompt, brief + milestones, dispute reason, refund account, chat and ledger of one order. */
export default function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setD(null);
    setError(null);
    void api<AdminOrderDetail>(`/v1/admin/orders/${encodeURIComponent(id)}`).then(setD, (e: Error) => setError(e.message));
  }, [id]);
  // Opening the detail scrolls to it and moves focus to its heading (it used to appear unnoticed below the list).
  useEffect(() => {
    root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    title.current?.focus({ preventScroll: true });
  }, [id]);
  const o = d?.order;
  const st = o ? statusOf(o) : null;
  return (
    <section ref={root} className="card mt-4 space-y-4 text-sm" aria-label={`Chi tiết đơn ${id}`}>
      <div className="flex items-center justify-between">
        <h2 ref={title} tabIndex={-1} className="font-display text-lg font-bold">Chi tiết đơn {id} (chỉ đọc)</h2>
        <button className="btn-outline btn-compact" onClick={onClose}>Đóng</button>
      </div>
      {error && (
        <div className="banner-danger" role="alert">
          <span className="material-symbols-outlined" aria-hidden>error</span>
          <p>{error}</p>
        </div>
      )}
      {!d && !error && (
        <div aria-busy="true" className="space-y-2">
          <span className="sr-only">Đang tải chi tiết đơn</span>
          <div className="skeleton h-16" />
          <div className="skeleton h-24" />
        </div>
      )}
      {d && o && st && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={st.tone}>{st.label}</Chip>
            <span className="font-mono text-xs text-stone-600">{o.status}</span>
            <span>
              Khách {o.customerName}
              {o.customerEmail && ` (${o.customerEmail})`}
              {o.customerPhone && ` · ${o.customerPhone}`}
              {o.coderName && ` · coder ${o.coderName}`}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Giá', o.priceVnd, 'text-stone-900'],
              ['Đã nạp', o.paidVnd, 'text-stone-900'],
              ['Escrow đang giữ', o.escrowVnd, 'text-blue-700'],
              ['Freelancer nhận', o.payoutVnd, 'text-teal-700'],
            ].map(([k, v, cls]) => (
              <div key={k as string} className="rounded-xl border border-stone-200 p-3">
                <dt className="text-xs text-stone-600">{k}</dt>
                <dd className={`font-display text-lg font-extrabold tabular-nums ${cls}`}>{vnd(v as number)}</dd>
              </div>
            ))}
          </dl>

          <p>
            STK nhận hoàn:{' '}
            {d.refundAccount ? (
              <span className="font-mono font-bold">{`${d.refundAccount.bankName} · ${d.refundAccount.accountNumber} · ${d.refundAccount.accountName}`}</span>
            ) : (
              <Chip tone="warn">Khách chưa nhập</Chip>
            )}
          </p>
          {o.disputeReason && (
            <div className="banner-danger">
              <span className="material-symbols-outlined" aria-hidden>gavel</span>
              <p>Lý do tranh chấp: {o.disputeReason}</p>
            </div>
          )}
          <div>
            <h3 className="font-display font-bold">Yêu cầu của khách</h3>
            <p className="whitespace-pre-wrap">{d.prompt}</p>
          </div>
          <div>
            <h3 className="font-display font-bold">Đặc tả: {d.brief.title}</h3>
            <p className="whitespace-pre-wrap text-stone-600">{d.brief.scopeSummary}</p>
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
                    <div key={e.account} className="tabular-nums">
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
