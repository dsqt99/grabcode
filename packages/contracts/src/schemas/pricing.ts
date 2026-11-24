import { z } from 'zod';

// ============================================================================================
// BẢNG GIÁ & CHIA DOANH THU — nguồn duy nhất. Web (menu, giá từ) và core-api (giá đơn, sổ cái) đều đọc từ file này.
// Đổi số ở đây, không gõ lại ở chỗ khác.
// Founder chốt (HON-10 Q3): menu "giá từ" theo loại việc (HON-9 mục 1); admin báo giá chốt trên từng đơn DRAFT trước
// khi khách chuyển khoản (POST /v1/admin/orders/{id}/quote). Không có phụ phí theo độ dài mô tả.
// Tiền trả freelancer được chốt vào từng đơn (orders.payout_vnd) khi tạo và khi báo giá: đổi tỷ lệ chỉ áp dụng cho đơn mới.
// ============================================================================================

/** Một món. fromPriceVnd: giá từ (đơn mới mang giá này tới khi admin báo giá). days: số ngày giao dự kiến [min, max]. */
export interface MenuItem {
  code: string;
  name: string;
  scope: string;
  fromPriceVnd: number;
  days: readonly [number, number];
}

/** Menu HON-9 mục 1. Phạm vi ngoài mô tả thì admin báo giá thêm. */
export const MENU = [
  { code: 'FIX', name: 'Sửa bug / chỉnh sửa nhỏ', scope: 'Tối đa 3 lỗi hoặc chỉnh sửa trên web/app có sẵn', fromPriceVnd: 800_000, days: [1, 2] },
  { code: 'LANDING', name: 'Landing page 1 trang', scope: 'Bán 1 sản phẩm/sự kiện, form thu khách, gắn Pixel/GA, chuẩn mobile', fromPriceVnd: 2_500_000, days: [2, 3] },
  { code: 'COMPANY_SITE', name: 'Website giới thiệu doanh nghiệp', scope: '5–7 trang, tin tức, nút Zalo/Messenger, SEO cơ bản', fromPriceVnd: 5_000_000, days: [4, 6] },
  { code: 'SHOP', name: 'Web bán hàng cơ bản', scope: 'Tối đa 100 sản phẩm, giỏ hàng, COD + VietQR, quản lý đơn', fromPriceVnd: 10_000_000, days: [7, 10] },
  { code: 'ZALO_MINI_APP', name: 'Mini app Zalo', scope: 'Menu, đặt hàng, tích điểm thành viên, kết nối Zalo OA', fromPriceVnd: 12_000_000, days: [10, 14] },
  { code: 'CHATBOT', name: 'Chatbot Zalo OA / Messenger có AI', scope: 'Trả lời câu hỏi thường gặp, báo giá, thu thông tin khách', fromPriceVnd: 4_000_000, days: [3, 5] },
  { code: 'PAYMENT', name: 'Gắn thanh toán', scope: 'VietQR, payOS, VNPay, MoMo vào web có sẵn', fromPriceVnd: 3_000_000, days: [2, 4] },
  { code: 'MARKETPLACE_SYNC', name: 'Đồng bộ đơn Shopee/TikTok Shop', scope: 'Đổ đơn về Google Sheets, báo cáo doanh thu ngày', fromPriceVnd: 5_000_000, days: [4, 7] },
  { code: 'INTERNAL_TOOL', name: 'Tool nội bộ', scope: 'Quản lý kho, chấm công, CRM mini trên Sheets/AppSheet/web', fromPriceVnd: 4_000_000, days: [4, 7] },
  { code: 'BOOKING', name: 'Trang đặt lịch hẹn', scope: 'Spa, salon, phòng khám; nhắc lịch qua Zalo', fromPriceVnd: 6_000_000, days: [5, 7] },
  { code: 'RESCUE', name: 'Cứu app làm dở bằng AI', scope: 'Sửa lỗi, bảo mật, đăng nhập, deploy app đang làm dở', fromPriceVnd: 8_000_000, days: [5, 10] },
  { code: 'DEPLOY', name: 'Deploy, tên miền, SSL', scope: 'Đưa app có sẵn lên mạng, hướng dẫn quản trị', fromPriceVnd: 1_500_000, days: [1, 2] },
  { code: 'MVP', name: 'MVP web app nhỏ', scope: 'Đăng nhập, quản lý dữ liệu, thanh toán, trang quản trị', fromPriceVnd: 25_000_000, days: [14, 28] },
] as const satisfies readonly MenuItem[];

export type MenuItemCode = (typeof MENU)[number]['code'];
export const MenuItemCodeSchema = z.enum(MENU.map((m) => m.code) as [MenuItemCode, ...MenuItemCode[]]);

export const menuItemOf = (code: string | null | undefined): MenuItem | undefined => MENU.find((m) => m.code === code);

/** "dự kiến 2–3 ngày". Món nhiều ngày không hiện ETA dạng giờ. */
export const daysLabel = ([min, max]: readonly [number, number]) => `dự kiến ${min === max ? min : `${min}–${max}`} ngày`;

/** ETA của một đơn (etaHours) theo ngày: "dự kiến N ngày"; đơn cũ dưới 1 ngày vẫn ghi theo giờ. */
export const etaLabel = (etaHours: number) => (etaHours >= 24 ? `dự kiến ${Math.ceil(etaHours / 24)} ngày` : `dự kiến ~${etaHours} giờ`);

/**
 * Tỷ lệ giá đơn trả cho freelancer (phần còn lại là doanh thu nền tảng). Founder đã chốt 75% (HON-1, HON-27); nền tảng giữ 25%;
 * chỉ sửa dòng này. Tiền trả được làm tròn tới 1.000đ.
 */
export const CODER_PAYOUT_RATE = 0.75;

/** Trọng số mốc mặc định khi brief không tự đặt (brief mẫu, brief-worker). */
export const DEFAULT_MILESTONE_WEIGHTS = [20, 50, 30];

/** Tiền trả freelancer cho một đơn giá `priceVnd` theo tỷ lệ hiện hành. */
export const payoutOf = (priceVnd: number) => Math.round((priceVnd * CODER_PAYOUT_RATE) / 1000) * 1000;

/** Giá tạm ("giá từ") và thời gian dự kiến của đơn mới, trước khi admin báo giá. Server tạo đơn bằng chính hàm này. */
export function estimateOrder(code: MenuItemCode) {
  const item = menuItemOf(code)!;
  return { priceVnd: item.fromPriceVnd, etaHours: item.days[1] * 24 };
}
