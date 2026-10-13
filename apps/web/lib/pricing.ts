import { OrderTier, SEED_TEMPLATES } from '@grabcode/contracts';

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
  { id: 'EXPRESS', label: 'Express', hours: 3, basePriceVnd: 2800000, blurb: 'POC gọn, giao link demo trong 3 giờ', icon: 'bolt' },
  { id: 'STANDARD', label: 'Standard', hours: 8, basePriceVnd: 2000000, blurb: 'Cân bằng giá và tốc độ, giao trong 8 giờ', icon: 'schedule' },
  { id: 'PRO', label: 'Enterprise', hours: 24, basePriceVnd: 6500000, blurb: 'Luồng nghiệp vụ phức tạp, QA kỹ, giao trong 24 giờ', icon: 'domain' },
  { id: 'TEMPLATE', label: 'Mua Template', hours: 2, basePriceVnd: 2200000, blurb: 'Tuỳ biến từ mẫu có sẵn, nhanh nhất', icon: 'dashboard_customize' },
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

export function estimate(tier: OrderTier, prompt: string, templateId?: string | null): Estimate {
  const cfg = getTier(tier);
  const tpl = getTemplate(templateId);
  let price = cfg.basePriceVnd;
  let eta = cfg.hours;
  if (tier === 'TEMPLATE' && tpl) {
    price = tpl.basePriceVnd;
    eta = tpl.etaHours;
  } else if (tpl) {
    price = Math.round(price * 0.85);
  }
  // Longer prompts imply more scope: +100k per 80 chars beyond 120, capped.
  const extra = Math.min(Math.max(0, prompt.length - 120) / 80, 10);
  price += Math.round(extra) * 100000;
  return { priceVnd: Math.round(price / 10000) * 10000, etaHours: eta };
}

export type Currency = 'VND' | 'USD';

export function formatVnd(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} đ`;
}

export function formatMoney(vnd: number, currency: Currency = 'VND'): string {
  if (currency === 'USD') return `$${(vnd / USD_RATE).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return formatVnd(vnd);
}
