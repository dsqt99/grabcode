'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PaymentInstructions } from '@grabcode/contracts/schemas';
import { pollDelay } from '@grabcode/contracts';
import { devDeposit, getOrderPayment, onHint, reportTransfer } from '../lib/api';
import { formatVnd } from '../lib/pricing';
import CopyButton from './CopyButton';
import StickyActionBar from './StickyActionBar';
import SupportContact from './SupportContact';

const POLL_MS = 3000;

/** VietQR image is cross-origin: fetch it as a blob to download; if the host blocks that, open it so the user can save it. */
async function saveQr(url: string, orderId: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `grabcode-${orderId}-qr.png` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function Row({ label, children, copy }: { label: string; children: React.ReactNode; copy?: { value: string; label: string } }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-600">{label}</p>
        <div className="break-words font-semibold text-ink">{children}</div>
      </div>
      {copy && <CopyButton {...copy} />}
    </div>
  );
}

/**
 * Bank transfer / VietQR for an unpaid (DRAFT) order (UX spec HON-18 "Màn A"). Always VND, whatever currency the user picked.
 * The order page's own poll moves on once the order is funded.
 */
export default function PaymentPanel({ orderId }: { orderId: string }) {
  const [p, setP] = useState<PaymentInstructions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [qrBroken, setQrBroken] = useState(false);

  const load = useCallback(
    () =>
      getOrderPayment(orderId).then(
        (next) => (setP(next), setLoadError(false)),
        (e) => (console.warn(e), setLoadError(true)),
      ),
    [orderId],
  );

  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout>;
    const tick = () => (t = setTimeout(() => void load().finally(tick), pollDelay(POLL_MS)));
    tick();
    const off = onHint((h) => h.orderId === orderId && void load()); // a deposit (ledger tx) sends an order hint
    return () => {
      clearTimeout(t);
      off();
    };
  }, [orderId, load]);

  if (!p) {
    return loadError ? (
      <section className="card space-y-3 border-red-200" role="alert">
        <p className="font-semibold text-red-800">Không tải được thông tin thanh toán.</p>
        <button type="button" className="btn-secondary" onClick={() => void load()}>Thử lại</button>
      </section>
    ) : (
      <section className="card space-y-3" aria-busy="true" aria-label="Đang tải thông tin thanh toán">
        <div className="h-16 animate-pulse rounded-md bg-slate-100" />
        <div className="mx-auto h-60 w-60 animate-pulse rounded-md bg-slate-100" />
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
      </section>
    );
  }

  const simulate = async () => {
    setBusy(true);
    setP(await devDeposit(orderId).catch(() => p));
    setBusy(false);
  };
  const report = async () => {
    setBusy(true);
    setReportError(false);
    try {
      setP(await reportTransfer(orderId));
    } catch (e) {
      console.warn(e);
      setReportError(true);
    } finally {
      setBusy(false);
    }
  };

  const paidFull = p.dueVnd === 0;

  if (!p.bank && !paidFull) {
    return (
      <section className="card space-y-2 border-amber-300" role="alert">
        <h2 className="font-display text-lg font-bold text-ink">Tạm thời chưa nhận thanh toán</h2>
        <p className="text-sm text-slate-700">GrabCode chưa cấu hình tài khoản nhận tiền. Vui lòng quay lại sau hoặc liên hệ hỗ trợ:</p>
        <SupportContact />
      </section>
    );
  }

  return (
    <section className="card space-y-4 border-amber-300 shadow-l3" aria-label="Thanh toán chuyển khoản">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bước 1/2</p>
        <h2 className="font-display text-lg font-bold text-ink">Chuyển khoản để bắt đầu</h2>
      </div>

      {paidFull ? (
        <p className="rounded-md bg-emerald-mint p-3 font-semibold text-emerald-dark" role="status">
          Đã nhận đủ {formatVnd(p.priceVnd)}. Đơn đang được đưa lên bảng việc.
        </p>
      ) : (
        <>
          {p.paidVnd > 0 && (
            <p className="rounded-md bg-amber-tint p-3 text-sm font-semibold text-amber-text" role="status">
              Đã nhận {formatVnd(p.paidVnd)}. Còn thiếu {formatVnd(p.dueVnd)} — chuyển tiếp với cùng nội dung {p.content}.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
            <div>
              <p className="text-xs text-slate-600">Số tiền cần chuyển</p>
              <p className="font-display text-2xl font-extrabold tabular-nums text-emerald-dark">{formatVnd(p.dueVnd)}</p>
            </div>
            <CopyButton value={String(p.dueVnd)} label="số tiền" />
          </div>

          <div className="md:grid md:grid-cols-[240px_1fr] md:gap-6">
            <div className="flex flex-col items-center gap-2">
              {qrBroken ? (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">Không tải được mã QR — hãy chuyển khoản tay theo thông tin bên cạnh.</p>
              ) : (
                <>
                  <img
                    src={p.bank!.qrUrl}
                    alt={`Mã VietQR chuyển ${formatVnd(p.dueVnd)}, nội dung ${p.content}`}
                    width={240}
                    height={240}
                    onError={() => setQrBroken(true)}
                    className="h-60 w-60 rounded-md border border-slate-200 bg-white"
                  />
                  <button type="button" className="btn-ghost min-h-[44px] text-sm" onClick={() => void saveQr(p.bank!.qrUrl, orderId)}>
                    Lưu ảnh QR
                  </button>
                  <p className="text-center text-xs text-slate-600">Mở app ngân hàng → Quét QR. Số tiền và nội dung đã điền sẵn.</p>
                </>
              )}
            </div>

            <div className="mt-4 min-w-0 md:mt-0">
              <h3 className="font-display text-sm font-bold text-ink">Hoặc chuyển khoản tay</h3>
              <Row label="Ngân hàng">{p.bank!.name}</Row>
              <Row label="Số tài khoản" copy={{ value: p.bank!.accountNumber.replace(/\s+/g, ''), label: 'số tài khoản' }}>
                <span className="font-mono">{p.bank!.accountNumber}</span>
              </Row>
              <Row label="Chủ tài khoản">{p.bank!.accountName}</Row>
              <div className="mt-2 rounded-md bg-amber-tint p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-amber-text">Nội dung chuyển khoản</p>
                    <p className="font-mono text-lg font-bold text-ink">{p.content}</p>
                  </div>
                  <CopyButton value={p.content} label="nội dung chuyển khoản" />
                </div>
                <p className="mt-2 text-sm text-amber-text">
                  Ghi đúng nội dung {p.content}, không thêm chữ khác. Sai nội dung sẽ phải chờ đối soát thủ công.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold">Sau khi chuyển</p>
            <p>
              {p.autoConfirm ? 'Ngân hàng xác nhận tự động, thường trong vài phút.' : 'GrabCode đối soát thủ công và xác nhận sớm nhất có thể.'} Trang này tự cập
              nhật, bạn có thể đóng và quay lại từ{' '}
              <Link href="/orders" className="font-semibold underline">Đơn của tôi</Link>.
            </p>
          </div>

          {p.devDeposit && (
            <button type="button" className="w-full rounded-full border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" disabled={busy} onClick={simulate}>
              Giả lập đã chuyển khoản (dev)
            </button>
          )}

          <StickyActionBar>
            {p.reportedAt ? (
              <p className="flex min-h-[48px] items-center justify-center rounded-full bg-blue-50 px-4 text-center text-sm font-semibold text-blue-900" role="status">
                Đã báo, chờ đối soát
              </p>
            ) : (
              <button type="button" className="btn-secondary w-full" disabled={busy} onClick={report}>
                {busy ? 'Đang gửi…' : 'Tôi đã chuyển khoản'}
              </button>
            )}
            {reportError && (
              <p className="text-center text-sm font-semibold text-red-700" role="alert">
                Chưa gửi được, hãy thử lại. GrabCode vẫn tự kiểm tra giao dịch.
              </p>
            )}
          </StickyActionBar>
        </>
      )}
    </section>
  );
}
