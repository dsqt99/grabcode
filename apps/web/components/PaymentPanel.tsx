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
import { BRAND } from '@grabcode/contracts';


const POLL_MS = 3000;

/** VietQR image is cross-origin: fetch it as a blob to download; if the host blocks that, open it so the user can save it. */
async function saveQr(url: string, orderId: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${BRAND.name.toLowerCase()}-${orderId}-qr.png` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function Row({ label, children, copy }: { label: string; children: React.ReactNode; copy?: { value: string; label: string } }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-stone-100 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-stone-600">{label}</p>
        <div className="break-words text-stone-900">{children}</div>
      </div>
      {copy && <CopyButton {...copy} />}
    </div>
  );
}

/**
 * Bank transfer / VietQR for an unpaid (DRAFT) order (UX spec HON-18 "Màn A", redesign-web-order §3.1). Always VND,
 * whatever currency the user picked. Mobile first: a phone cannot scan the QR it is showing, so copy buttons and the
 * transfer content come before the QR. The order page's own poll moves on once the order is funded.
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
      <section className="banner-danger" role="alert">
        <span className="material-symbols-outlined" aria-hidden>error</span>
        <div className="space-y-2">
          <p className="font-semibold">Không tải được thông tin thanh toán. Kiểm tra kết nối rồi thử lại.</p>
          <button type="button" className="btn-outline btn-sm" onClick={() => void load()}>Thử lại</button>
        </div>
      </section>
    ) : (
      <section className="card space-y-3" aria-busy="true" aria-label="Đang tải thông tin thanh toán">
        <div className="skeleton h-16" />
        <div className="skeleton h-24" />
        <div className="skeleton mx-auto h-60 w-60" />
      </section>
    );
  }

  // HON-10 Q3: no QR / bank account before Ai Code AI quotes the final price (the server sends none either).
  if (!p.priceQuoted) {
    return (
      <section className="card space-y-3 border-l-4 border-l-blue-600" aria-labelledby="quote-title" role="status">
        <h2 id="quote-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
          <span className="material-symbols-outlined text-blue-700" aria-hidden>request_quote</span>
          Chờ {BRAND.name} báo giá
        </h2>
        <p className="text-stone-700">
          {BRAND.name} đang đọc yêu cầu và sẽ báo giá chốt cho đơn này (giá từ {formatVnd(p.priceVnd)}). Mã QR chuyển khoản hiện ở đây khi có giá chốt.
          Trang này tự cập nhật.
        </p>
        <div>
          <p className="font-display text-sm font-bold text-stone-900">Tiếp theo</p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-stone-700">
            <li>{BRAND.name} báo giá chốt (trang này tự cập nhật)</li>
            <li>Bạn chuyển khoản theo mã QR</li>
            <li>Đơn lên bảng việc</li>
          </ol>
        </div>
        <p className="banner-warn">
          <span className="material-symbols-outlined !text-[20px]" aria-hidden>warning</span>
          Vui lòng chưa chuyển khoản trước khi có giá chốt.
        </p>
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

  if (paidFull) {
    return (
      <p className="banner-success font-semibold" role="status">
        <span className="material-symbols-outlined !text-[20px]" aria-hidden>check_circle</span>
        Đã nhận đủ {formatVnd(p.priceVnd)}. Đơn đang được đưa lên bảng việc.
      </p>
    );
  }

  if (!p.bank) {
    return (
      <section className="banner-warn" role="alert">
        <span className="material-symbols-outlined" aria-hidden>warning</span>
        <div className="space-y-1">
          <h2 className="font-display text-base font-bold">Tạm thời chưa nhận thanh toán</h2>
          <p>{BRAND.name} chưa cấu hình tài khoản nhận tiền. Vui lòng quay lại sau hoặc liên hệ hỗ trợ:</p>
          <SupportContact />
        </div>
      </section>
    );
  }
  const bank = p.bank;

  return (
    <section className="card-action space-y-4" aria-labelledby="pay-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Bước 1/2 · Chuyển khoản</p>
        <h2 id="pay-title" className="font-display text-lg font-bold text-stone-900 md:text-xl">Chuyển khoản để bắt đầu</h2>
      </div>

      {p.paidVnd > 0 && (
        <p className="banner-warn font-semibold" role="status">
          Đã nhận {formatVnd(p.paidVnd)}. Còn thiếu {formatVnd(p.dueVnd)} — chuyển tiếp với cùng nội dung {p.content}.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-4">
          <div>
            <p className="text-sm text-stone-600">Số tiền cần chuyển</p>
            <p className="whitespace-nowrap font-display text-2xl font-extrabold tabular-nums text-stone-900 md:text-[28px]">{formatVnd(p.dueVnd)}</p>
          </div>
          <CopyButton value={String(p.dueVnd)} label="số tiền" />
        </div>

        {/* The transfer content comes before the QR: a wrong content is the costliest mistake (manual reconciliation). */}
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Nội dung chuyển khoản (bắt buộc)</p>
              <p className="break-all font-mono text-xl font-bold text-stone-900">{p.content}</p>
            </div>
            <CopyButton value={p.content} label="nội dung chuyển khoản" />
          </div>
          <p className="mt-2 text-sm text-amber-900">Ghi đúng {p.content}, không thêm chữ khác. Sai nội dung sẽ phải chờ đối soát thủ công.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr] md:gap-6">
        <div className="space-y-2">
          <h3 className="font-display text-base font-bold text-stone-900">Cách 1 – Dùng mã QR</h3>
          {qrBroken ? (
            <p className="banner-info">Không tải được mã QR — hãy chuyển khoản tay theo thông tin bên dưới.</p>
          ) : (
            <>
              <img
                src={bank.qrUrl}
                alt={`Mã VietQR chuyển ${formatVnd(p.dueVnd)}, nội dung ${p.content}`}
                width={240}
                height={240}
                onError={() => setQrBroken(true)}
                className="mx-auto h-60 w-60 rounded-xl border border-stone-200 bg-white"
              />
              <button type="button" className="btn-outline w-full" onClick={() => void saveQr(bank.qrUrl, orderId)}>
                <span className="material-symbols-outlined !text-[20px]" aria-hidden>download</span>
                Lưu ảnh QR
              </button>
              <p className="help">Mở app ngân hàng → Quét QR → Chọn ảnh từ thư viện. Số tiền và nội dung đã điền sẵn.</p>
            </>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-stone-900">Cách 2 – Chuyển khoản tay</h3>
          <Row label="Ngân hàng"><span className="font-semibold">{bank.name}</span></Row>
          <Row label="Số tài khoản" copy={{ value: bank.accountNumber.replace(/\s+/g, ''), label: 'số tài khoản' }}>
            <span className="font-mono text-lg font-bold tracking-wide">{bank.accountNumber}</span>
          </Row>
          <Row label="Chủ tài khoản"><span className="font-bold">{bank.accountName}</span></Row>
          <p className="help">Kiểm tra đúng tên chủ tài khoản trước khi chuyển. Chỉ chuyển theo thông tin trên trang này.</p>
        </div>
      </div>

      <div className="banner-info">
        <span className="material-symbols-outlined !text-[20px]" aria-hidden>info</span>
        <div>
          <p className="font-semibold">Sau khi chuyển</p>
          <p>
            {p.autoConfirm ? 'Ngân hàng xác nhận tự động, thường trong vài phút.' : `${BRAND.name} đối soát thủ công và xác nhận sớm nhất có thể.`} Trang này tự cập
            nhật, bạn có thể đóng và quay lại từ{' '}
            <Link href="/orders" className="font-semibold underline">Đơn của tôi</Link>.
          </p>
        </div>
      </div>

      {p.devDeposit && (
        <button type="button" className="min-h-[48px] w-full rounded-full border-2 border-dashed border-stone-300 px-4 text-sm font-semibold text-stone-700" disabled={busy} onClick={simulate}>
          Giả lập đã chuyển khoản (dev)
        </button>
      )}

      <StickyActionBar>
        {p.reportedAt ? (
          <p className="banner-info min-h-[48px] items-center font-semibold" role="status">
            <span className="material-symbols-outlined !text-[20px]" aria-hidden>schedule</span>
            Đã báo chuyển khoản, đang chờ đối soát
          </p>
        ) : (
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={report}>
            {busy ? (
              <>
                <span className="material-symbols-outlined spinner" aria-hidden>progress_activity</span>
                Đang gửi…
              </>
            ) : (
              'Tôi đã chuyển khoản'
            )}
          </button>
        )}
        {reportError && (
          <p className="error-text justify-center lg:justify-start" role="alert">
            Chưa gửi được, hãy thử lại. {BRAND.name} vẫn tự kiểm tra giao dịch.
          </p>
        )}
      </StickyActionBar>
    </section>
  );
}
