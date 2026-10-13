'use client';

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
    <section className="card flex flex-col items-center gap-4 py-8 text-center shadow-l2">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {isOnline && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-emerald/50 bg-emerald/10 animate-sonar" />
            <span
              className="absolute inset-0 rounded-full border-2 border-emerald/50 bg-emerald/10 animate-sonar"
              style={{ animationDelay: '0.8s' }}
            />
            <span
              className="absolute inset-0 rounded-full border-2 border-emerald/50 bg-emerald/10 animate-sonar"
              style={{ animationDelay: '1.6s' }}
            />
          </>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={isOnline}
          aria-label={isOnline ? 'Chuyển sang Offline' : 'Chuyển sang Online'}
          onClick={() => onToggle(!isOnline)}
          className={`relative z-10 flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full font-display text-lg font-extrabold shadow-l3 transition active:scale-95 ${
            isOnline ? 'bg-emerald text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined !text-[32px]">{isOnline ? 'wifi_tethering' : 'power_settings_new'}</span>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </button>
      </div>
      <div>
        <p className="font-display text-base font-bold text-ink">
          {isOnline ? 'Đang quét cuốc đơn quanh bạn…' : 'Bạn đang tắt nhận đơn'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {hint ?? (isOnline ? 'Giữ ứng dụng mở để không bỏ lỡ cuốc đơn.' : 'Bật Online để bắt đầu nhận cuốc.')}
        </p>
      </div>
    </section>
  );
}
