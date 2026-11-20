import type { Order } from '@grabcode/contracts';
import { milestoneShare, type OrderDto, type OrderMoney } from '@grabcode/contracts/schemas';
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

export function statusView(o: StatusInput): StatusView {
  const { paidVnd, heldVnd, releasedVnd, refundedVnd } = o.money;
  const coder = o.coderName ?? 'Freelancer';
  const base = { canReview: false, canAccept: false, canDispute: false, askRefundAccount: false };
  switch (o.status) {
    case 'DRAFT':
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
        description: 'Đã nhận tiền, đang chờ freelancer nhận đơn. Không ai nhận trong 24 giờ thì GrabCode hoàn tiền.',
        money: `Đã nhận ${v(paidVnd)} · đang giữ tại GrabCode`,
        step: 1,
        askRefundAccount: true,
      };
    case 'IN_PROGRESS': {
      const submitted = o.milestones.find((m) => m.status === 'SUBMITTED');
      const current = o.milestones.find((m) => m.status !== 'COMPLETED');
      return {
        ...base,
        ...(submitted
          ? { tone: 'warn', label: 'Chờ bạn duyệt mốc', description: `${coder} đã nộp ${submitted.id}. Kiểm tra và duyệt để trả phần tiền của mốc.` }
          : { tone: 'brand', label: 'Đang làm', description: current ? `${coder} đang làm mốc ${current.id}.` : `${coder} đang hoàn thiện để bàn giao.` }),
        money: `Đang giữ ${v(heldVnd)} · đã trả freelancer ${v(releasedVnd)}`,
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
        description: 'Freelancer đã bàn giao toàn bộ. Kiểm tra rồi nghiệm thu.',
        money: `Đang giữ ${v(heldVnd)} · đã trả freelancer ${v(releasedVnd)}`,
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
        money: `Đã trả freelancer toàn bộ ${v(releasedVnd)}`,
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
        money: `Tạm giữ ${v(heldVnd)} · đã trả freelancer ${v(releasedVnd)}`,
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

// ---- "Đơn của tôi" (UX spec Màn D, BA P0-6) ----

export type OrderTab = 'action' | 'active' | 'done' | 'cancelled';
export const ORDER_TABS: { id: OrderTab; label: string }[] = [
  { id: 'action', label: 'Cần bạn xử lý' },
  { id: 'active', label: 'Đang làm' },
  { id: 'done', label: 'Hoàn tất' },
  { id: 'cancelled', label: 'Đã huỷ' },
];

/** What the customer has to do on the order now; null = nothing (waiting on the freelancer or GrabCode). */
export function customerTodo(o: Pick<StatusInput, 'status' | 'milestones'>): string | null {
  if (o.status === 'DRAFT') return 'Chờ bạn chuyển khoản';
  if (o.status === 'DELIVERED') return 'Chờ bạn nghiệm thu';
  const submitted = o.status === 'IN_PROGRESS' && o.milestones.find((m) => m.status === 'SUBMITTED');
  return submitted ? `Chờ bạn duyệt ${submitted.id}` : null;
}

export function orderTab(o: Pick<StatusInput, 'status' | 'milestones'>): OrderTab {
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
    status === 'ACCEPTED' ? o.priceVnd : ms.reduce((s, m, i) => s + (m.status === 'COMPLETED' ? milestoneShare(o.priceVnd, ms.map((x) => x.weightPercent), i) : 0), 0);
  return {
    status,
    money: o.money ?? { paidVnd, heldVnd: paidVnd - releasedVnd, releasedVnd, refundedVnd: 0 },
    priceVnd: o.priceVnd,
    milestones: ms,
    coderName: o.assignedCoder?.name,
    disputeReason: o.disputeReason,
    completedAt: o.completedAt,
  };
}

/** Escrow share milestone `id` releases when approved: same formula the server pays with (contracts). */
export function milestoneAmount(o: Pick<Order, 'priceVnd' | 'brief'>, id: string): number {
  const ms = o.brief.milestones;
  return milestoneShare(o.priceVnd, ms.map((m) => m.weightPercent), ms.findIndex((m) => m.id === id));
}
