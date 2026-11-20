import { SUBJECTS } from '@grabcode/contracts/schemas';

// Ops notices (HON-10 Q5: Telegram bot to the admin group). Pure text building so it is unit-testable; admin.ts loads the rows.

/** Subjects ops hear about: new order (to quote), customer says they transferred, dispute, coder withdrawal. */
export const ADMIN_SUBJECTS = ['order.created', 'order.disputed', SUBJECTS.PAYMENT_REPORTED, SUBJECTS.PAYOUT_REQUESTED] as const;
export type AdminSubject = (typeof ADMIN_SUBJECTS)[number];

/** What the worker read from Postgres for the event. Party = customer (orders) or coder (payout). */
export interface AdminFacts {
  orderId?: string;
  title?: string;
  /** Order price (quoted or "giá từ"), due amount (payment.reported) or payout amount. */
  amountVnd: number;
  priceQuoted?: boolean;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  reason?: string | null;
  bankAccount?: string;
  adminUrl: string;
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('de-DE')} đ`;

/** Plain text (no parse_mode): customer-written titles and reasons need no escaping. */
export function adminNoticeFor(type: AdminSubject, f: AdminFacts): string {
  const party = (label: string) => `${label}: ${f.partyName} · SĐT: ${f.partyPhone ?? 'chưa có'}${f.partyEmail ? ` · ${f.partyEmail}` : ''}`;
  const lines = (() => {
    switch (type) {
      case 'order.created':
        return [
          `🆕 Đơn mới ${f.orderId}${f.priceQuoted ? '' : ' — cần báo giá'}`,
          f.title ?? '',
          `${f.priceQuoted ? 'Giá' : 'Giá từ'}: ${vnd(f.amountVnd)}`,
          party('Khách'),
        ];
      case SUBJECTS.PAYMENT_REPORTED:
        return [`💸 Khách báo đã chuyển khoản đơn ${f.orderId}`, `Số tiền cần đối soát: ${vnd(f.amountVnd)}`, party('Khách')];
      case 'order.disputed':
        return [`⚠️ Tranh chấp đơn ${f.orderId}`, `Giá đơn: ${vnd(f.amountVnd)}`, party('Khách'), `Lý do: ${f.reason ?? '(không ghi)'}`];
      case SUBJECTS.PAYOUT_REQUESTED:
        return [`🏦 Yêu cầu rút tiền ${vnd(f.amountVnd)}`, party('Freelancer'), `Tài khoản: ${f.bankAccount ?? ''}`];
    }
  })();
  return [...lines.filter(Boolean), `Admin: ${f.adminUrl}`].join('\n');
}
