import { SEED_TEMPLATES } from '@grabcode/contracts';
import { MENU, menuItemOf, type MenuItem, type MenuItemCode } from '@grabcode/contracts/schemas';

export { MENU, daysLabel, etaLabel, menuItemOf } from '@grabcode/contracts/schemas';
export type { MenuItem, MenuItemCode };

export const USD_RATE = 25000;

export const FRAMEWORKS = ['Next.js 15 + Tailwind CSS', 'FastAPI + React', 'Flutter', 'Node.js + Express', 'Laravel'];

export function isMenuItem(v: string | null | undefined): v is MenuItemCode {
  return !!menuItemOf(v);
}

/** Menu item from a URL param; the first item (small fix) when missing or unknown. */
export function getMenuItem(code: string | null | undefined): MenuItem & { code: MenuItemCode } {
  return (menuItemOf(code) ?? MENU[0]) as MenuItem & { code: MenuItemCode };
}

export function getTemplate(id?: string | null) {
  return SEED_TEMPLATES.find((t) => t.id === id);
}

export type Currency = 'VND' | 'USD';

export function formatVnd(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} đ`;
}

/** Payment, escrow and payout screens always show VND; a USD user only gets this grey "≈ $" hint next to it. */
export function usdHint(vnd: number, currency: Currency): string | null {
  return currency === 'USD' ? `≈ ${formatMoney(vnd, 'USD')}` : null;
}

export function formatMoney(vnd: number, currency: Currency = 'VND'): string {
  if (currency === 'USD') return `$${(vnd / USD_RATE).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return formatVnd(vnd);
}
