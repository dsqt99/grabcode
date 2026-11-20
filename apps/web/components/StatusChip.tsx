import type { Tone } from '../lib/orderStatus';

/** Order tone -> redesign-ds status chip: warn = waiting on you, info = waiting on others, brand = freelancer working. */
const CHIP: Record<Tone, string> = {
  warn: 'chip-warn',
  info: 'chip-info',
  brand: 'chip-progress',
  ok: 'chip-success',
  danger: 'chip-danger',
  neutral: 'chip-neutral',
};

/** Left accent of the order status card (redesign-web-order §2). */
export const TONE_BORDER: Record<Tone, string> = {
  warn: 'border-l-amber-500',
  info: 'border-l-blue-600',
  brand: 'border-l-brand-600',
  ok: 'border-l-teal-600',
  danger: 'border-l-red-600',
  neutral: 'border-l-stone-400',
};

/** Order status chip shared by the order page (Màn B) and "Đơn của tôi" (Màn D). */
export default function StatusChip({ tone, label }: { tone: Tone; label: string }) {
  return <span className={CHIP[tone]}>{label}</span>;
}
