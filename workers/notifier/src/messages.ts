import { SUBJECTS, type ChatPostedEvent, type DispatchEvent, type MilestoneEvent, type OrderEvent } from '@grabcode/contracts/schemas';

export interface Notice {
  userIds: string[];
  title: string;
  body: string;
  /** Path on the web origin the click opens. */
  url: string;
}

const order = (id: string) => `/order/${id}`;
const CODER = '/coder';
const vnd = (n: number) => `${n.toLocaleString('vi-VN')} đ`;

/** Which users hear about an event, and what they read. Events nobody needs to hear about map to []. */
export function noticesFor(e: OrderEvent | DispatchEvent | ChatPostedEvent | MilestoneEvent): Notice[] {
  const { orderId } = e.data;
  if (e.type === SUBJECTS.MILESTONE_SUBMITTED || e.type === SUBJECTS.MILESTONE_APPROVED || e.type === SUBJECTS.MILESTONE_REJECTED) {
    const { milestoneId: m, customerUserId: cust, coderUserId: coder, note, payoutVnd } = (e as MilestoneEvent).data;
    if (e.type === SUBJECTS.MILESTONE_SUBMITTED) {
      return [{ userIds: [cust], title: `Mốc ${m} chờ bạn duyệt`, body: `Freelancer đã nộp mốc ${m} của đơn ${orderId}. Kiểm tra và duyệt để tiếp tục.`, url: order(orderId) }];
    }
    if (e.type === SUBJECTS.MILESTONE_REJECTED) {
      return [{ userIds: [coder], title: `Khách yêu cầu sửa mốc ${m}`, body: note ? `Đơn ${orderId}: ${note.slice(0, 120)}` : `Đơn ${orderId} cần chỉnh sửa`, url: CODER }];
    }
    return [{ userIds: [coder], title: `Mốc ${m} đã được duyệt`, body: payoutVnd > 0 ? `+${vnd(payoutVnd)} vào ví · đơn ${orderId}` : `Đơn ${orderId}`, url: CODER }];
  }
  if (e.type === SUBJECTS.CHAT_POSTED) {
    const { toCustomerUserId: cust, toCoderUserId: coder, senderName, preview } = (e as ChatPostedEvent).data;
    const title = `${senderName} · ${orderId}`;
    return [
      ...(cust ? [{ userIds: [cust], title, body: preview, url: order(orderId) }] : []),
      ...(coder ? [{ userIds: [coder], title, body: preview, url: CODER }] : []),
    ];
  }
  if (e.type === SUBJECTS.DISPATCH_OFFERED) {
    const ids = (e as DispatchEvent).data.coderUserIds;
    return ids.length ? [{ userIds: ids, title: 'Cuốc đơn mới', body: `Đơn ${orderId} đang chờ bạn nhận`, url: CODER }] : [];
  }
  if (!('status' in e.data)) return [];
  const { customerUserId: cust, coderUserId: coder, from } = e.data;
  const both = coder ? [cust, coder] : [cust];
  switch (e.type) {
    case 'order.funded':
      return [{ userIds: [cust], title: 'Đã nhận đủ tiền', body: `Đơn ${orderId} đã lên bảng việc, đang chờ freelancer nhận`, url: order(orderId) }];
    case 'order.started':
      return from === 'DISPATCHED'
        ? [{ userIds: [cust], title: 'Freelancer đã nhận đơn', body: `Đơn ${orderId} bắt đầu thực hiện`, url: order(orderId) }]
        : coder ? [{ userIds: [coder], title: 'Khách yêu cầu sửa', body: `Đơn ${orderId} cần chỉnh sửa`, url: CODER }] : [];
    case 'order.delivered':
      return [{ userIds: [cust], title: 'Đơn đã bàn giao', body: `Đơn ${orderId} chờ bạn nghiệm thu`, url: order(orderId) }];
    case 'order.accepted':
      return coder ? [{ userIds: [coder], title: 'Khách đã nghiệm thu', body: `Đơn ${orderId} hoàn tất`, url: CODER }] : [];
    case 'order.disputed':
      return coder ? [{ userIds: [coder], title: 'Đơn bị tranh chấp', body: `Khách mở tranh chấp đơn ${orderId}`, url: CODER }] : [];
    case 'order.resolved':
      return [{ userIds: both, title: 'Tranh chấp đã xử lý', body: `Admin đã chia tiền đơn ${orderId}`, url: order(orderId) }];
    case 'order.cancelled':
      return from === 'DRAFT' ? [] : [{ userIds: both, title: 'Đơn đã huỷ', body: `Đơn ${orderId} đã huỷ và hoàn tiền`, url: order(orderId) }];
    default:
      return [];
  }
}
