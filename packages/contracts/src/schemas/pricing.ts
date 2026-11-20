import type { z } from 'zod';
import type { OrderTierSchema } from './brief';

// ============================================================================================
// BẢNG GIÁ & CHIA DOANH THU — nguồn duy nhất. Web (ước tính trước khi đặt) và core-api (giá thật,
// sổ cái) đều đọc từ file này. Đổi số ở đây, không gõ lại ở chỗ khác.
// Tiền trả freelancer được chốt vào từng đơn lúc tạo (orders.payout_vnd): đổi tỷ lệ chỉ áp dụng cho đơn mới.
// ============================================================================================

/** Giá gốc và thời gian dự kiến (ước tính, không phải cam kết) theo gói. */
export const TIER_PRICING: Record<z.infer<typeof OrderTierSchema>, { basePriceVnd: number; hours: number }> = {
  EXPRESS: { basePriceVnd: 2_800_000, hours: 3 },
  STANDARD: { basePriceVnd: 2_000_000, hours: 8 },
  PRO: { basePriceVnd: 6_500_000, hours: 24 },
  TEMPLATE: { basePriceVnd: 2_200_000, hours: 2 },
};

/** Giá theo template có sẵn (gói TEMPLATE). Template không có ở đây dùng TIER_PRICING.TEMPLATE. */
export const TEMPLATE_PRICING: Record<string, { basePriceVnd: number; etaHours: number }> = {
  'tpl-realestate-crm': { basePriceVnd: 2_800_000, etaHours: 3 },
  'tpl-saas-billing': { basePriceVnd: 3_500_000, etaHours: 4 },
  'tpl-ecommerce-fast': { basePriceVnd: 2_200_000, etaHours: 2 },
  'tpl-voice-agent': { basePriceVnd: 4_900_000, etaHours: 6 },
};

/** Gói tự chọn (không phải TEMPLATE) nhưng dựng từ một template: nhân giá gói với hệ số này. */
export const TEMPLATE_BASE_DISCOUNT = 0.85;

/** Mô tả dài = phạm vi lớn: cộng `stepVnd` cho mỗi `perChars` ký tự vượt `freeChars`, tối đa `maxSteps` bước. */
export const PROMPT_SURCHARGE = { freeChars: 120, perChars: 80, stepVnd: 100_000, maxSteps: 10 };

/**
 * Tỷ lệ giá đơn trả cho freelancer (phần còn lại là doanh thu nền tảng). CEO chốt số cuối cùng;
 * chỉ sửa ở đây. Tiền trả được làm tròn tới 1.000đ.
 */
export const CODER_PAYOUT_RATE = 0.7;

/** Trọng số mốc mặc định khi brief không tự đặt (brief mẫu, brief-worker). */
export const DEFAULT_MILESTONE_WEIGHTS = [20, 50, 30];

/** Tiền trả freelancer cho một đơn giá `priceVnd` theo tỷ lệ hiện hành. */
export const payoutOf = (priceVnd: number) => Math.round((priceVnd * CODER_PAYOUT_RATE) / 1000) * 1000;

/** Giá và thời gian dự kiến của một đơn. Server tính giá thật bằng chính hàm này. */
export function estimateOrder(tier: z.infer<typeof OrderTierSchema>, prompt: string, templateId?: string | null) {
  // hasOwn: templateId comes from the request ("constructor" must not hit Object.prototype).
  const tpl = templateId && Object.hasOwn(TEMPLATE_PRICING, templateId) ? TEMPLATE_PRICING[templateId] : undefined;
  let price = TIER_PRICING[tier].basePriceVnd;
  let eta = TIER_PRICING[tier].hours;
  if (tier === 'TEMPLATE' && tpl) {
    price = tpl.basePriceVnd;
    eta = tpl.etaHours;
  } else if (tpl) {
    price = Math.round(price * TEMPLATE_BASE_DISCOUNT);
  }
  const s = PROMPT_SURCHARGE;
  const steps = Math.min(Math.max(0, prompt.length - s.freeChars) / s.perChars, s.maxSteps);
  price += Math.round(steps) * s.stepVnd;
  return { priceVnd: Math.round(price / 10000) * 10000, etaHours: eta };
}
