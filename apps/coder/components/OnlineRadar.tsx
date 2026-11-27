'use client';

/** Receive-orders row (replaces the 224px radar): a switch, not a hero. Props kept from the old component. */
export default function OnlineRadar({
  isOnline,
  onToggle,
  hint,
}: {
  isOnline: boolean;
  onToggle: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <section className="card flex min-h-[72px] items-center gap-3 p-4!">
      <span className={`h-3 w-3 shrink-0 rounded-full ${isOnline ? 'animate-pulse bg-teal-600 motion-reduce:animate-none' : 'bg-stone-400'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-bold text-stone-900">{isOnline ? 'Đang nhận đơn mới' : 'Đang tắt nhận đơn'}</p>
        <p className="text-sm text-stone-600">
          {hint ?? (isOnline ? 'Giữ app mở để nhận thông báo đơn mới.' : 'Bật để nhận đơn mới gửi tới bạn.')}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOnline}
        aria-label="Nhận đơn mới"
        onClick={() => onToggle(!isOnline)}
        className="grid h-11 w-[52px] shrink-0 place-items-center"
      >
        <span className={`relative h-8 w-[52px] rounded-full transition ${isOnline ? 'bg-brand-700' : 'bg-stone-300'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${isOnline ? 'left-[24px]' : 'left-1'}`} />
        </span>
      </button>
    </section>
  );
}
