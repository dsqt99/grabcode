import { OrderTier, SEED_TEMPLATES } from '@grabcode/contracts';
import { TIER_PRICING, estimateOrder } from '@grabcode/contracts/schemas';

export const USD_RATE = 25000;

export interface TierConfig {
  id: OrderTier;
  label: string;
  hours: number;
  basePriceVnd: number;
  blurb: string;
  icon: string;
}

export const TIERS: TierConfig[] = [
  { id: 'EXPRESS', label: 'Express', ...TIER_PRICING.EXPRESS, blurb: 'POC gọn, giao link demo trong 3 giờ', icon: 'bolt' },
  { id: 'STANDARD', label: 'Standard', ...TIER_PRICING.STANDARD, blurb: 'Cân bằng giá và tốc độ, giao trong 8 giờ', icon: 'schedule' },
  { id: 'PRO', label: 'Enterprise', ...TIER_PRICING.PRO, blurb: 'Luồng nghiệp vụ phức tạp, QA kỹ, giao trong 24 giờ', icon: 'domain' },
  { id: 'TEMPLATE', label: 'Mua Template', ...TIER_PRICING.TEMPLATE, blurb: 'Tuỳ biến từ mẫu có sẵn, nhanh nhất', icon: 'dashboard_customize' },
];

export const FRAMEWORKS = ['Next.js 15 + Tailwind CSS', 'FastAPI + React', 'Flutter', 'Node.js + Express', 'Laravel'];

export function getTier(id: OrderTier): TierConfig {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export function isTier(v: string | null | undefined): v is OrderTier {
  return v === 'EXPRESS' || v === 'STANDARD' || v === 'PRO' || v === 'TEMPLATE';
}

export function getTemplate(id?: string | null) {
  return SEED_TEMPLATES.find((t) => t.id === id);
}

export interface Estimate {
  priceVnd: number;
  etaHours: number;
}

/** Same formula the server charges with. */
export const estimate: (tier: OrderTier, prompt: string, templateId?: string | null) => Estimate = estimateOrder;

export type Currency = 'VND' | 'USD';

export function formatVnd(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} đ`;
}

export function formatMoney(vnd: number, currency: Currency = 'VND'): string {
  if (currency === 'USD') return `$${(vnd / USD_RATE).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return formatVnd(vnd);
}
