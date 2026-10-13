import type { OrderStatus } from '@grabcode/contracts';
import { STAGES, stageIndex } from '../lib/orderView';

export default function LiveStepper({ status, percent }: { status: OrderStatus; percent: number }) {
  const current = stageIndex(status);
  return (
    <div className="card shadow-l2">
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Tiến trình đơn hàng">
        {STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} aria-current={active ? 'step' : undefined} className="flex items-center gap-3">
              <span
                className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                  done ? 'bg-emerald text-white' : active ? 'bg-emerald-mint text-emerald-dark ring-2 ring-emerald' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {active && <span className="absolute inset-0 animate-sonar rounded-full bg-emerald/30" aria-hidden />}
                <span className="material-symbols-outlined relative !text-[20px]" aria-hidden>{done ? 'check' : s.icon}</span>
              </span>
              <span className={`font-display text-sm font-semibold leading-tight ${done || active ? 'text-ink' : 'text-slate-400'}`}>
                {s.label}
                <span className="sr-only">{done ? ' (đã xong)' : active ? ' (đang diễn ra)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
          <span>Tiến độ theo mốc</span>
          <span className="text-emerald-dark">{percent}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ">
          <div className="h-full rounded-full bg-emerald transition-all duration-700" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
