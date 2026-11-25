import type { Order } from '@grabcode/contracts';
import { milestoneShare, releasesOnApproval, type OrderDto, type OrderMoney } from '@grabcode/contracts/schemas';
import { formatVnd } from './pricing';

// Customer order page: chip, sentence, money line, stepper step and allowed actions per core-api status
// (UX spec HON-18 "Màn B"). Reads the raw OrderDto status: DISPUTED / CANCELLED / RESOLVED each get their own state.
import { BRAND } from '@grabcode/contracts';


export type ServerStatus = OrderDto['status'];
export type Tone = 'warn' | 'info' | 'brand' | 'ok' | 'danger' | 'neutral';

export const STEPS = ['Thanh toán', 'Tìm coder', 'Đang nấu demo', 'Nhận & duyệt', 'Hoàn tất'] as const;

export interface StatusInput {
  status: ServerStatus;
  money: OrderMoney;
  priceVnd: number;
  /** false: DRAFT waiting for Ai Code AI's quote (priceVnd is the menu "giá từ"). */
  priceQuoted: boolean;
  milestones: Order['brief']['milestones'];
  coderName?: string;
  disputeReason?: string;
  completedAt?: string;
}

export interface StatusView {
  tone: Tone;
  label: string;
  description: string;
  money: string;
  /** Active step index in STEPS; null = stepper greyed out (dispute, cancelled, resolved). */
  step: number | null;
  /** Approve / request changes on the SUBMITTED milestone. */
  canReview: boolean;
  /** Accept the whole order / ask for a revision (DELIVERED only). */
  canAccept: boolean;
  canDispute: boolean;
  /** Customer may enter the bank account a refund goes to (paid order that may still be cancelled or split). */
  askRefundAccount: boolean;
}

const v = formatVnd;
/** dd/MM, as in the spec (toLocaleDateString('vi-VN') gives "20-11" in Chromium). */
export const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** P0-3 AC3: what left escrow for approved milestones (price share, not the coder's cut) out of the order total. */
const disbursed = (releasedVnd: number, priceVnd: number) => `Đã giải ngân ${v(releasedVnd)} / tổng ${v(priceVnd)}`;

export function statusView(o: StatusInput): StatusView {
  const { paidVnd, heldVnd, releasedVnd, refundedVnd } = o.money;
  const coder = o.coderName ?? 'Freelancer';
  const base = { canReview: false, canAccept: false, canDispute: false, askRefundAccount: false };
  switch (o.status) {
    case 'DRAFT':
      if (!o.priceQuoted) {
        return {
          ...base,
          tone: 'warn',
          label: 'Chờ báo giá',
          description: `${BRAND.name} đang xem yêu cầu và sẽ báo giá chốt. Bạn chỉ chuyển khoản sau khi có giá chốt.`,
          money: `Giá từ ${v(o.priceVnd)} · chưa thanh toán`,
          step: 0,
          askRefundAccount: paidVnd > 0,
        };
      }
      return {
        ...base,
        tone: 'warn',
        label: 'Chờ thanh toán',
        description: 'Chuyển khoản để đưa đơn lên bảng việc.',
        money: paidVnd > 0 ? `Đã nhận ${v(paidVnd)} / ${v(o.priceVnd)}` : 'Chưa thanh toán',
        step: 0,
        askRefundAccount: paidVnd > 0,
      };
    case 'FUNDED':
    case 'DISPATCHED':
      return {
        ...base,
        tone: 'info',
        label: 'Đang tìm coder',
        description: `Đã nhận tiền, đang chờ freelancer nhận đơn. Không ai nhận trong 24 giờ thì ${BRAND.name} hoàn tiền.`,
        money: `Đã nhận ${v(paidVnd)} · đang giữ tại ${BRAND.name}`,
        step: 1,
        askRefundAccount: true,
      };
    case 'IN_PROGRESS': {
      const submitted = o.milestones.find((m) => m.status === 'SUBMITTED');
      const current = o.milestones.find((m) => m.status !== 'COMPLETED');
      const last = submitted && submitted.id === o.milestones[o.milestones.length - 1]?.id;
      return {
        ...base,
        ...(submitted
          ? {
              tone: 'warn',
              label: 'Chờ bạn duyệt mốc',
              description: last
                ? `${coder} đã nộp mốc cuối ${submitted.id}. Kiểm tra và duyệt; tiền mốc cuối được trả khi bạn nghiệm thu cả đơn.`
                : `${coder} đã nộp ${submitted.id}. Kiểm tra và duyệt để trả phần tiền của mốc.`,
            }
          : { tone: 'brand', label: 'Đang nấu demo', description: current ? `${coder} đang làm mốc ${current.id}.` : `${coder} đang hoàn thiện để bàn giao.` }),
        money: `${disbursed(releasedVnd, o.priceVnd)} · đang giữ ${v(heldVnd)}`,
        step: 2,
        canReview: true,
        canDispute: true,
        askRefundAccount: true,
      } as StatusView;
    }
    case 'DELIVERED':
      return {
        ...base,
        tone: 'warn',
        label: 'Demo đã giao, chờ bạn nhận',
        description: 'Freelancer đã bàn giao toàn bộ. Kiểm tra rồi nghiệm thu, hoặc yêu cầu sửa.',
        money: `${disbursed(releasedVnd, o.priceVnd)} · đang giữ ${v(heldVnd)}`,
        step: 3,
        canAccept: true,
        canDispute: true,
        askRefundAccount: true,
      };
    case 'ACCEPTED': {
      const day = o.completedAt ? dayMonth(o.completedAt) : null;
      return {
        ...base,
        tone: 'ok',
        label: 'Hoàn tất',
        description: day ? `Đã nghiệm thu ngày ${day}.` : 'Đã nghiệm thu.',
        money: disbursed(releasedVnd, o.priceVnd),
        step: 4,
      };
    }
    case 'DISPUTED':
      return {
        ...base,
        tone: 'danger',
        label: 'Đang tranh chấp',
        description:
          heldVnd > 0
            ? `${BRAND.name} đang xem xét. ${v(heldVnd)} còn lại được tạm giữ tới khi có kết quả.`
            : `${BRAND.name} đang xem xét. Không còn tiền tạm giữ (0 đ): các mốc đã duyệt đã được trả cho freelancer.`,
        money: `Tạm giữ ${v(heldVnd)} · ${disbursed(releasedVnd, o.priceVnd).toLowerCase()}`,
        step: null,
        askRefundAccount: heldVnd > 0,
      };
    case 'RESOLVED':
      return {
        ...base,
        tone: 'neutral',
        label: 'Đã xử lý tranh chấp',
        description: `Kết quả: hoàn bạn ${v(refundedVnd)}, trả freelancer ${v(releasedVnd)}.`,
        money: refundedVnd > 0 ? `Hoàn bạn ${v(refundedVnd)}` : 'Không hoàn tiền',
        step: null,
        askRefundAccount: refundedVnd > 0,
      };
    case 'CANCELLED':
      return {
        ...base,
        tone: 'neutral',
        label: 'Đã huỷ',
        description:
          refundedVnd > 0
            ? `Đơn đã huỷ. ${BRAND.name} hoàn ${v(refundedVnd)} vào tài khoản nhận hoàn bạn khai báo bên dưới.`
            : 'Đơn đã huỷ. Bạn chưa chuyển khoản nên không có khoản nào cần hoàn.',
        money: refundedVnd > 0 ? `Hoàn ${v(refundedVnd)}` : 'Không thu tiền',
        step: null,
        askRefundAccount: refundedVnd > 0,
      };
  }
}

// ---- "Đơn của tôi" (UX spec Màn D, BA P0-6) ----

export type OrderTab = 'action' | 'active' | 'done' | 'cancelled';
export const ORDER_TABS: { id: OrderTab; label: string }[] = [
  { id: 'action', label: 'Cần bạn xử lý' },
  { id: 'active', label: 'Đang nấu demo' },
  { id: 'done', label: 'Hoàn tất' },
  { id: 'cancelled', label: 'Đã huỷ' },
];

/** What the customer has to do on the order now; null = nothing (waiting on the freelancer or Ai Code AI). */
export function customerTodo(o: Pick<StatusInput, 'status' | 'priceQuoted' | 'milestones'>): string | null {
  // Unquoted DRAFT: Ai Code AI owes the quote, there is no QR to pay yet (P0-7).
  if (o.status === 'DRAFT') return o.priceQuoted ? 'Chờ bạn chuyển khoản' : null;
  if (o.status === 'DELIVERED') return 'Demo đã giao, chờ bạn nhận';
  const submitted = o.status === 'IN_PROGRESS' && o.milestones.find((m) => m.status === 'SUBMITTED');
  return submitted ? `Chờ bạn duyệt ${submitted.id}` : null;
}

export function orderTab(o: Pick<StatusInput, 'status' | 'priceQuoted' | 'milestones'>): OrderTab {
  if (customerTodo(o)) return 'action';
  if (o.status === 'ACCEPTED' || o.status === 'RESOLVED') return 'done';
  return o.status === 'CANCELLED' ? 'cancelled' : 'active';
}

const MOCK_STATUS: Record<Order['status'], ServerStatus> = {
  DRAFT: 'DRAFT',
  DISPATCHING: 'FUNDED',
  ACCEPTED: 'IN_PROGRESS',
  BUILDING: 'IN_PROGRESS',
  QA_TESTING: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
};

/** API orders carry the server status and ledger money; mock (demo) orders derive both from the local state. */
export function statusInput(o: Order): StatusInput {
  const status = o.serverStatus ?? MOCK_STATUS[o.status];
  const ms = o.brief.milestones;
  const paidVnd = status === 'DRAFT' ? 0 : o.priceVnd;
  const releasedVnd =
    status === 'ACCEPTED'
      ? o.priceVnd
      : ms.reduce((s, m, i) => s + (m.status === 'COMPLETED' && releasesOnApproval(i, ms.length) ? milestoneShare(o.priceVnd, ms.map((x) => x.weightPercent), i) : 0), 0);
  return {
    status,
    money: o.money ?? { paidVnd, heldVnd: paidVnd - releasedVnd, releasedVnd, refundedVnd: 0 },
    priceVnd: o.priceVnd,
    priceQuoted: o.priceQuoted ?? true,
    milestones: ms,
    coderName: o.assignedCoder?.name,
    disputeReason: o.disputeReason,
    completedAt: o.completedAt,
  };
}

/** Approving milestone `id` pays its share now; false for the last one (held until the whole order is accepted, Q2). */
export function paysOnApproval(o: Pick<Order, 'brief'>, id: string): boolean {
  const ms = o.brief.milestones;
  return releasesOnApproval(ms.findIndex((m) => m.id === id), ms.length);
}

/** Escrow share of milestone `id`: same formula the server pays with (contracts). */
export function milestoneAmount(o: Pick<Order, 'priceVnd' | 'brief'>, id: string): number {
  const ms = o.brief.milestones;
  return milestoneShare(o.priceVnd, ms.map((m) => m.weightPercent), ms.findIndex((m) => m.id === id));
}
