import type { Order } from '@grabcode/contracts';
import { milestoneShare, releasesOnApproval, type OrderDto, type OrderMoney } from '@grabcode/contracts/schemas';
import { formatVnd } from './pricing';

// Customer order page: chip, sentence, money line, stepper step and allowed actions per core-api status
// (UX spec HON-18 "Màn B"). Reads the raw OrderDto status: DISPUTED / CANCELLED / RESOLVED each get their own state.

export type ServerStatus = OrderDto['status'];
export type Tone = 'warn' | 'info' | 'brand' | 'ok' | 'danger' | 'neutral';

export const STEPS = ['Thanh toán', 'Tìm freelancer', 'Đang làm', 'Nghiệm thu', 'Hoàn tất'] as const;

export interface StatusInput {
  status: ServerStatus;
  money: OrderMoney;
  priceVnd: number;
  /** false: DRAFT waiting for GrabCode's quote (priceVnd is the menu "giá từ"). */
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
          description: 'GrabCode đang xem yêu cầu và sẽ báo giá chốt. Bạn chỉ chuyển khoản sau khi có giá chốt.',
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
        label: 'Đang tìm freelancer',
        description: 'Đơn đã lên bảng việc. Freelancer phù hợp sẽ nhận sớm nhất có thể.',
        money: `Đã nhận ${v(paidVnd)} · đang giữ tại GrabCode`,
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
          : { tone: 'brand', label: 'Đang làm', description: current ? `${coder} đang làm mốc ${current.id}.` : `${coder} đang hoàn thiện để bàn giao.` }),
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
        label: 'Chờ bạn nghiệm thu',
        description: 'Freelancer đã bàn giao toàn bộ. Kiểm tra rồi nghiệm thu, hoặc yêu cầu sửa.',
        money: `${disbursed(releasedVnd, o.priceVnd)} · đang giữ ${v(heldVnd)}`,
        step: 3,
        canAccept: true,
        canDispute: true,
        askRefundAccount: true,
      };
    case 'ACCEPTED': {
      const day = o.completedAt ? new Date(o.completedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : null;
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
            ? `GrabCode đang xem xét. ${v(heldVnd)} còn lại được tạm giữ tới khi có kết quả.`
            : 'GrabCode đang xem xét. Không còn tiền tạm giữ (0 đ): các mốc đã duyệt đã được trả cho freelancer.',
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
            ? `Đơn đã huỷ. GrabCode hoàn ${v(refundedVnd)} vào tài khoản nhận hoàn bạn khai báo bên dưới.`
            : 'Đơn đã huỷ. Bạn chưa chuyển khoản nên không có khoản nào cần hoàn.',
        money: refundedVnd > 0 ? `Hoàn ${v(refundedVnd)}` : 'Không thu tiền',
        step: null,
        askRefundAccount: refundedVnd > 0,
      };
  }
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
