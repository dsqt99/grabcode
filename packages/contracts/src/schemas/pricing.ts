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
  /** Nhóm khách: SHOP = chủ shop online/SME, FOUNDER = founder có prototype/ý tưởng AI. */
  audience: 'SHOP' | 'FOUNDER';
  /** Câu hỏi mẫu khách hay đặt, hiện trên trang chủ; "Dùng mẫu" điền câu này và chọn đúng gói. */
  sampleQuestion: string;
}

/** Trần cứng của một đơn (HON-60 mục 4): giá gói + giao gấp + mọi phụ phí. Chợ chỉ bán bản demo/POC ngắn, mỗi đơn dưới 3.000.000 đ. */
export const MAX_ORDER_VND = 2_990_000;

/** Thông báo khi một giá vượt trần (API, admin báo giá, giao diện dùng chung một câu). */
export const orderCapMessage = (maxVnd = MAX_ORDER_VND) =>
  `Đơn tối đa ${maxVnd.toLocaleString('de-DE')} đ. Việc lớn hơn bản demo cần tách thành các đơn riêng, mỗi đơn có brief và thanh toán riêng.`;

/** Menu 8 gói POC/demo của HON-60 (poc-menu-under-3m). Giá là giá trọn gói, admin có thể chốt giá khác nhưng không vượt MAX_ORDER_VND. */
export const MENU = [
  { code: 'DEMO_LANDING', name: 'Demo trang bán 1 sản phẩm', scope: '1 trang mobile chạy thật trên link demo: ảnh, giá, form đặt hàng gửi về Zalo/Sheets. Không làm nhiều trang, SEO, pixel, tên miền riêng.', fromPriceVnd: 1_500_000, days: [2, 2], audience: 'SHOP', sampleQuestion: 'Mình bán son handmade, cần 1 trang có nút đặt qua Zalo, 2 ngày làm được không?' },
  { code: 'DEMO_SHOP', name: 'Demo shop mini', scope: 'Tối đa 10 sản phẩm mẫu + giỏ hàng + đặt đơn COD, chạy trên link demo. Không thanh toán thật, kho, tài khoản khách, trang quản trị đầy đủ.', fromPriceVnd: 2_900_000, days: [3, 3], audience: 'SHOP', sampleQuestion: 'Mình có 30 mẫu áo, muốn khách chọn size, thêm giỏ, đặt thử trên điện thoại' },
  { code: 'DEMO_CHATBOT', name: 'Demo chatbot trả lời khách', scope: 'Bot AI trả lời 10 câu hỏi thường gặp, chạy ở kênh thử (Messenger/Zalo test). Không gắn vào trang/OA thật, không chốt đơn.', fromPriceVnd: 2_000_000, days: [3, 3], audience: 'SHOP', sampleQuestion: 'Tối nào khách cũng hỏi giá và ship, bot trả lời giùm được không?' },
  { code: 'DEMO_SHEETS_SYNC', name: 'Demo đồng bộ đơn về Google Sheets', scope: 'Nhập file đơn xuất từ sàn (CSV) vào Sheets, tự tính doanh thu ngày và 1 báo cáo mẫu. Không kết nối API sàn, không chạy tự động.', fromPriceVnd: 2_200_000, days: [3, 3], audience: 'SHOP', sampleQuestion: 'Đơn Shopee/TikTok mình ngồi chép tay, có cách tự đổ vào Sheets không?' },
  { code: 'DEMO_BOOKING', name: 'Demo đặt lịch hẹn', scope: 'Luồng chọn dịch vụ, giờ, xác nhận; lịch hiện ra cho chủ tiệm (dữ liệu mẫu). Không nhắc lịch Zalo thật, thanh toán, nhiều chi nhánh.', fromPriceVnd: 2_400_000, days: [3, 3], audience: 'SHOP', sampleQuestion: 'Spa mình muốn khách tự chọn dịch vụ và giờ, khỏi nhắn tin qua lại' },
  { code: 'APP_CHECKUP', name: 'Khám & sửa mẫu app AI làm dở', scope: 'Báo cáo khám 1–2 trang (lỗi, rủi ro, việc cần làm) + sửa mẫu 1 lỗi nặng nhất, có video trước/sau. Không sửa toàn bộ app, không đưa lên máy chủ thật.', fromPriceVnd: 1_500_000, days: [2, 2], audience: 'FOUNDER', sampleQuestion: 'App mình làm bằng AI chạy được nửa chừng, lỗi hoài, không biết hư ở đâu' },
  { code: 'DEMO_AI_DOCS', name: 'Demo tính năng AI trên dữ liệu của bạn', scope: 'Giao diện chat hỏi đáp trên tối đa 10 tài liệu mẫu, trả lời có trích nguồn, chạy trên link demo. Không dữ liệu nhạy cảm/số lượng lớn, không phân quyền.', fromPriceVnd: 2_900_000, days: [3, 3], audience: 'FOUNDER', sampleQuestion: 'Mình có 50 file PDF chính sách, muốn có chat hỏi đáp để show khách/nhà đầu tư' },
  { code: 'DEMO_APP_FLOW', name: 'Demo 1 luồng cho ý tưởng app', scope: '1 luồng chính chạy trên điện thoại/trình duyệt với dữ liệu mẫu. Không đăng nhập thật, lưu dữ liệu lâu dài, thanh toán, lên kho ứng dụng.', fromPriceVnd: 2_500_000, days: [3, 3], audience: 'FOUNDER', sampleQuestion: 'Mình có ý tưởng app giao hàng nội bộ, cần 1 màn chạy được để show đối tác' },
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

/**
 * Trọng số mốc mặc định khi brief không tự đặt (brief mẫu, brief-worker). HON-60: cọc 30% rồi chi 70/30 = mốc 1 và mốc giữa gộp một lần chi (20+50),
 * nên trọng số giữ nguyên. Cọc 30% ở phía thu tiền CHƯA áp dụng: hệ thống vẫn thu đủ giá trước khi giao việc (xem PR HON-63).
 */
export const DEFAULT_MILESTONE_WEIGHTS = [20, 50, 30];

/** Tiền trả freelancer cho một đơn giá `priceVnd` theo tỷ lệ hiện hành. */
export const payoutOf = (priceVnd: number) => Math.round((priceVnd * CODER_PAYOUT_RATE) / 1000) * 1000;

/** Giá tạm ("giá từ") và thời gian dự kiến của đơn mới, trước khi admin báo giá. Server tạo đơn bằng chính hàm này. */
export function estimateOrder(code: MenuItemCode) {
  const item = menuItemOf(code)!;
  if (item.fromPriceVnd > MAX_ORDER_VND) throw new Error(`Menu item ${code} is above the order cap`);
  return { priceVnd: item.fromPriceVnd, etaHours: item.days[1] * 24 };
}
