import { STEPS } from '../lib/orderStatus';

/**
 * Compact order progress inside the status card (redesign-web-order §2): "Bước n/5" + a 5-segment bar.
 * `step`: active index in STEPS; null hides the bar (`paused` = dispute says so, cancelled/resolved show nothing).
 */
export default function LiveStepper({ step, percent, paused }: { step: number | null; percent: number; paused?: boolean }) {
  if (step === null) return paused ? <p className="text-sm text-stone-600">Tiến trình tạm dừng</p> : null;
  // The last step ("Hoàn tất") is done, not ongoing, once reached.
  const last = step === STEPS.length - 1;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-stone-900">
        Bước {step + 1}/{STEPS.length} · {STEPS[step]}
      </p>
      <div
        className="grid grid-cols-5 gap-1"
        role="progressbar"
        aria-label="Tiến trình đơn hàng"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Bước ${step + 1} trên ${STEPS.length}: ${STEPS[step]}`}
      >
        {STEPS.map((label, i) => (
          <span key={label} className={`h-1.5 rounded-full ${i < step || (last && i === step) ? 'bg-teal-600' : i === step ? 'bg-brand-600' : 'bg-stone-200'}`} />
        ))}
      </div>
      {step >= 2 && <p className="text-xs text-stone-600">Tiến độ theo mốc {percent}%</p>}
    </div>
  );
}
