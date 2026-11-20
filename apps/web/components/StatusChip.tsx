import type { Tone } from '../lib/orderStatus';

const CHIP: Record<Tone, string> = {
  warn: 'chip-warn',
  info: 'chip bg-blue-50 text-blue-800',
  brand: 'chip-ok',
  ok: 'chip-ok',
  danger: 'chip bg-red-50 text-red-700',
  neutral: 'chip bg-slate-100 text-slate-700',
};

/** Order status chip shared by the order page (Màn B) and "Đơn của tôi" (Màn D). */
export default function StatusChip({ tone, label }: { tone: Tone; label: string }) {
  return <span className={CHIP[tone]}>{label}</span>;
}
