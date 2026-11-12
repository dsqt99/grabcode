import { SUBJECTS, type DispatchEvent, type OrderEvent } from '@grabcode/contracts/schemas';

export interface Notice {
  userIds: string[];
  title: string;
  body: string;
  /** Path on the web origin the click opens. */
  url: string;
}

const order = (id: string) => `/order/${id}`;
const CODER = '/coder';

/** Which users hear about an event, and what they read. Events nobody needs to hear about map to []. */
export function noticesFor(e: OrderEvent | DispatchEvent): Notice[] {
  const { orderId } = e.data;
  if (e.type === SUBJECTS.DISPATCH_OFFERED) {
    const ids = (e as DispatchEvent).data.coderUserIds;
    return ids.length ? [{ userIds: ids, title: 'Cuốc đơn mới', body: `Đơn ${orderId} đang chờ bạn nhận`, url: CODER }] : [];
  }
  if (!('customerUserId' in e.data)) return [];
  const { customerUserId: cust, coderUserId: coder, from } = e.data;
  const both = coder ? [cust, coder] : [cust];
  switch (e.type) {
    case 'order.funded':
      return [{ userIds: [cust], title: 'Đã nhận ký quỹ', body: `Đơn ${orderId} đã nạp đủ, đang tìm coder`, url: order(orderId) }];
    case 'order.started':
      return from === 'DISPATCHED'
        ? [{ userIds: [cust], title: 'Coder đã nhận đơn', body: `Đơn ${orderId} bắt đầu thực hiện`, url: order(orderId) }]
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
