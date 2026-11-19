'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type {
  CoderProfileDetails,
  CompanySize,
  CustomerProfile,
  ExperienceLevel,
  HoursPerWeek,
  LanguageLevel,
  Me,
  NotificationPrefs,
  UserRole,
} from '@grabcode/contracts/schemas';
import Navbar from '../../components/Navbar';
import { RequireAuth } from '@grabcode/auth-ui';
import { AuthError, useAuth } from '@grabcode/auth-ui';
import { useCurrency } from '../../lib/currency';
import { currentSubscription, pushKey, pushSupported, subscribePush, unsubscribePush } from '../../lib/push';

const INPUT = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal disabled:bg-slate-50 disabled:text-slate-500';
const LABEL = 'block text-sm font-semibold text-ink';

const SECTIONS = [
  { id: 'account', icon: 'person', label: 'Thông tin liên hệ' },
  { id: 'coder', icon: 'code', label: 'Hồ sơ Coder' },
  { id: 'customer', icon: 'business_center', label: 'Hồ sơ doanh nghiệp' },
  { id: 'prefs', icon: 'tune', label: 'Thông báo & hiển thị' },
  { id: 'security', icon: 'lock', label: 'Mật khẩu & bảo mật' },
];

const EXPERIENCE: { v: ExperienceLevel; title: string; text: string }[] = [
  { v: 'ENTRY', title: 'Mới vào nghề', text: 'Dưới 2 năm, làm POC nhỏ' },
  { v: 'INTERMEDIATE', title: 'Trung cấp', text: '2–5 năm, tự build full-stack' },
  { v: 'EXPERT', title: 'Chuyên gia', text: 'Trên 5 năm, kiến trúc & AI' },
];
const HOURS: { v: HoursPerWeek; label: string }[] = [
  { v: 'LT_10', label: 'Dưới 10 giờ/tuần' },
  { v: 'H10_30', label: '10–30 giờ/tuần' },
  { v: 'GT_30', label: 'Trên 30 giờ/tuần' },
];
const LANG_LEVEL: Record<LanguageLevel, string> = {
  BASIC: 'Cơ bản',
  CONVERSATIONAL: 'Giao tiếp',
  FLUENT: 'Thành thạo',
  NATIVE: 'Bản ngữ',
};
const COMPANY_SIZE: Record<CompanySize, string> = {
  SOLO: 'Cá nhân',
  S2_10: '2–10 người',
  S11_50: '11–50 người',
  S51_200: '51–200 người',
  S200_PLUS: 'Trên 200 người',
};
const NOTIFY: { k: keyof NotificationPrefs; label: string; text: string }[] = [
  { k: 'email', label: 'Email', text: 'Biên nhận ký quỹ, bàn giao mốc, tranh chấp' },
  { k: 'zalo', label: 'Zalo ZNS', text: 'Tin nhắn trạng thái đơn hàng' },
  { k: 'push', label: 'Thông báo đẩy', text: 'Cuốc đơn mới, chat realtime' },
];
const LOGIN_METHOD: Record<Me['loginMethod'], string> = {
  email: 'Email & mật khẩu',
  github: 'GitHub',
  google: 'Google',
  dev: 'Dev login',
};

const emptyToNull = (s: string) => (s.trim() ? s.trim() : null);
const errorText = (err: unknown) =>
  err instanceof AuthError && err.status === 400
    ? 'Dữ liệu không hợp lệ, kiểm tra lại URL / số điện thoại / độ dài.'
    : err instanceof AuthError && err.status === 401
      ? 'Mật khẩu hiện tại không đúng.'
      : 'Không lưu được, vui lòng thử lại.';

/** Save button + inline result shared by every section form. */
function useSave() {
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });
  const run = async (fn: () => Promise<void>, okMsg = 'Đã lưu thay đổi.') => {
    setState({ busy: true, msg: null, ok: false });
    try {
      await fn();
      setState({ busy: false, msg: okMsg, ok: true });
    } catch (err) {
      setState({ busy: false, msg: errorText(err), ok: false });
    }
  };
  const footer = (label = 'Lưu thay đổi') => (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
      <button type="submit" disabled={state.busy} className="btn-primary !py-2.5">
        {state.busy ? 'Đang lưu…' : label}
      </button>
      {state.msg && (
        <p className={`text-sm ${state.ok ? 'text-emerald-dark' : 'text-red-700'}`} role={state.ok ? 'status' : 'alert'}>
          {state.msg}
        </p>
      )}
    </div>
  );
  return { run, footer };
}

function Section({ id, title, text, children }: { id: string; title: string; text: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{text}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, text }: { checked: boolean; onChange: (v: boolean) => void; label: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {text && <span className="block text-xs text-slate-500">{text}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-emerald" />
    </label>
  );
}

/** Per-browser WebPush subscription; hidden when core-api has no VAPID key or the browser lacks Push. */
function PushDevice() {
  const [key, setKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!pushSupported()) return;
    void pushKey().then(setKey).catch(() => {});
    void currentSubscription().then((s) => setOn(Boolean(s))).catch(() => {});
  }, []);
  if (!key) return null;
  const toggle = async () => {
    setBusy(true);
    setErr('');
    try {
      if (on) await unsubscribePush();
      else await subscribePush(key);
      setOn(!on);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">{on ? 'Trình duyệt này đang nhận thông báo đẩy.' : 'Trình duyệt này chưa nhận thông báo đẩy.'}</span>
        <button type="button" disabled={busy} onClick={toggle} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50">
          {on ? 'Tắt trên trình duyệt này' : 'Bật trên trình duyệt này'}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function ActivateButton({ role, text }: { role: UserRole; text: string }) {
  const { addRole } = useAuth();
  const { run, footer } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addRole(role), 'Đã kích hoạt.');
      }}
    >
      <p className="text-sm text-slate-600">{text}</p>
      {footer(role === 'CODER' ? 'Trở thành Coder' : 'Bật vai trò Khách hàng')}
    </form>
  );
}

function AccountForm({ me }: { me: Me }) {
  const { updateMe } = useAuth();
  const { run, footer } = useSave();
  const [f, setF] = useState({
    name: me.name,
    avatarUrl: me.avatarUrl ?? '',
    phone: me.phone ?? '',
    country: me.country,
    timezone: me.timezone,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateMe({ name: f.name, avatarUrl: emptyToNull(f.avatarUrl), phone: emptyToNull(f.phone), country: f.country, timezone: f.timezone }),
        );
      }}
    >
      <div className="flex items-center gap-4">
        {f.avatarUrl ? (
          <img src={f.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald/30" />
        ) : (
          <span className="material-symbols-outlined grid h-16 w-16 place-items-center rounded-full bg-emerald/10 !text-[36px] text-emerald" aria-hidden>
            person
          </span>
        )}
        <label className={`${LABEL} flex-1`}>
          Ảnh đại diện (URL)
          <input type="url" value={f.avatarUrl} onChange={set('avatarUrl')} placeholder="https://…" className={INPUT} />
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Họ tên
          <input required maxLength={80} value={f.name} onChange={set('name')} className={INPUT} />
        </label>
        <label className={LABEL}>
          Email
          <input value={me.email ?? (me.githubLogin ? `@${me.githubLogin}` : '')} disabled className={INPUT} />
        </label>
        <label className={LABEL}>
          Số điện thoại
          <input type="tel" value={f.phone} onChange={set('phone')} placeholder="+84 912 345 678" pattern="\+?[0-9 ]{8,16}" className={INPUT} />
        </label>
        <label className={LABEL}>
          Quốc gia
          <select value={f.country} onChange={set('country')} className={INPUT}>
            <option value="VN">Việt Nam</option>
            <option value="SG">Singapore</option>
            <option value="US">Hoa Kỳ</option>
            <option value="JP">Nhật Bản</option>
            <option value="KR">Hàn Quốc</option>
          </select>
        </label>
        <label className={`${LABEL} sm:col-span-2`}>
          Múi giờ
          <select value={f.timezone} onChange={set('timezone')} className={INPUT}>
            {/* Keep the saved value even if this browser's IANA list lacks it (alias like Asia/Saigon). */}
            {[...new Set([f.timezone, ...Intl.supportedValuesOf('timeZone')])].map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </label>
      </div>
      {footer()}
    </form>
  );
}

function CoderForm({ me }: { me: Me }) {
  const { saveCoderProfile } = useAuth();
  const { run, footer } = useSave();
  const [p, setP] = useState<CoderProfileDetails>(
    me.coderProfile ?? {
      headline: '',
      bio: '',
      hourlyRateVnd: 300_000,
      experienceLevel: 'INTERMEDIATE',
      skills: [],
      hoursPerWeek: 'H10_30',
      languages: [{ language: 'Tiếng Việt', level: 'NATIVE' }],
      githubUrl: me.githubLogin ? `https://github.com/${me.githubLogin}` : null,
      portfolioUrls: [],
      isPublic: true,
      availableForWork: true,
    },
  );
  const [skill, setSkill] = useState('');
  const [portfolio, setPortfolio] = useState(p.portfolioUrls.join('\n'));

  const addSkill = () => {
    const s = skill.trim();
    if (s && !p.skills.includes(s) && p.skills.length < 20) setP({ ...p, skills: [...p.skills, s] });
    setSkill('');
  };
  const setLang = (i: number, patch: Partial<CoderProfileDetails['languages'][number]>) =>
    setP({ ...p, languages: p.languages.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const portfolioUrls = portfolio.split('\n').map((s) => s.trim()).filter(Boolean);
        run(() => saveCoderProfile({ ...p, portfolioUrls, languages: p.languages.filter((l) => l.language.trim()) }));
      }}
      className="grid gap-5"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle checked={p.availableForWork} onChange={(v) => setP({ ...p, availableForWork: v })} label="Sẵn sàng nhận đơn" text="Tắt khi bận, matching sẽ bỏ qua bạn" />
        <Toggle checked={p.isPublic} onChange={(v) => setP({ ...p, isPublic: v })} label="Hồ sơ công khai" text="Khách hàng xem được hồ sơ của bạn" />
      </div>

      <label className={LABEL}>
        Tiêu đề hồ sơ
        <input maxLength={80} value={p.headline} onChange={(e) => setP({ ...p, headline: e.target.value })} placeholder="Full-stack Next.js · AI chatbot · 5 năm kinh nghiệm" className={INPUT} />
      </label>

      <label className={LABEL}>
        Giới thiệu bản thân
        <textarea
          rows={5}
          maxLength={2000}
          value={p.bio}
          onChange={(e) => setP({ ...p, bio: e.target.value })}
          placeholder="Bạn giỏi gì, đã làm dự án nào, cách bạn làm việc với khách hàng…"
          className={INPUT}
        />
        <span className="mt-1 block text-right text-xs font-normal text-slate-400">{p.bio.length}/2000</span>
      </label>

      <fieldset>
        <legend className={LABEL}>Kinh nghiệm</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {EXPERIENCE.map((x) => (
            <label
              key={x.v}
              className={`cursor-pointer rounded-lg border p-3 transition ${p.experienceLevel === x.v ? 'border-emerald bg-emerald/5 ring-1 ring-emerald' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input type="radio" name="exp" className="sr-only" checked={p.experienceLevel === x.v} onChange={() => setP({ ...p, experienceLevel: x.v })} />
              <span className="block font-display text-sm font-bold text-ink">{x.title}</span>
              <span className="block text-xs text-slate-500">{x.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className={LABEL} htmlFor="skill">
          Kỹ năng <span className="font-normal text-slate-400">({p.skills.length}/20)</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {p.skills.map((s) => (
            <span key={s} className="chip-ok">
              {s}
              <button type="button" onClick={() => setP({ ...p, skills: p.skills.filter((x) => x !== s) })} aria-label={`Xóa ${s}`} className="ml-0.5">
                <span className="material-symbols-outlined !text-[14px]" aria-hidden>close</span>
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            id="skill"
            maxLength={40}
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="VD: Next.js, NestJS, LangChain — Enter để thêm"
            className={`${INPUT} !mt-0`}
          />
          <button type="button" onClick={addSkill} className="btn-ghost border border-slate-200">
            Thêm
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Giá theo giờ (VND)
          <input
            type="number"
            min={0}
            max={10_000_000}
            step={10_000}
            value={p.hourlyRateVnd}
            onChange={(e) => setP({ ...p, hourlyRateVnd: Math.round(Number(e.target.value) || 0) })}
            className={INPUT}
          />        </label>
        <label className={LABEL}>
          Thời gian làm việc
          <select value={p.hoursPerWeek} onChange={(e) => setP({ ...p, hoursPerWeek: e.target.value as HoursPerWeek })} className={INPUT}>
            {HOURS.map((h) => (
              <option key={h.v} value={h.v}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className={LABEL}>Ngôn ngữ</legend>
        <div className="mt-2 grid gap-2">
          {p.languages.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label="Ngôn ngữ" maxLength={40} value={l.language} onChange={(e) => setLang(i, { language: e.target.value })} className={`${INPUT} !mt-0`} />
              <select aria-label="Trình độ" value={l.level} onChange={(e) => setLang(i, { level: e.target.value as LanguageLevel })} className={`${INPUT} !mt-0 max-w-40`}>
                {Object.entries(LANG_LEVEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setP({ ...p, languages: p.languages.filter((_, j) => j !== i) })} className="btn-ghost !px-2" aria-label="Xóa ngôn ngữ">
                <span className="material-symbols-outlined !text-[18px]" aria-hidden>delete</span>
              </button>
            </div>
          ))}
        </div>
        {p.languages.length < 10 && (
          <button type="button" onClick={() => setP({ ...p, languages: [...p.languages, { language: '', level: 'CONVERSATIONAL' }] })} className="btn-ghost mt-2 !px-0 text-emerald-dark">
            <span className="material-symbols-outlined !text-[18px]" aria-hidden>add</span> Thêm ngôn ngữ
          </button>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          GitHub
          <input type="url" value={p.githubUrl ?? ''} onChange={(e) => setP({ ...p, githubUrl: emptyToNull(e.target.value) })} placeholder="https://github.com/…" className={INPUT} />
        </label>
        <label className={LABEL}>
          Portfolio / dự án đã làm
          <textarea rows={3} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="Mỗi dòng một URL, tối đa 5" className={INPUT} />
        </label>
      </div>
      {footer('Lưu hồ sơ Coder')}
    </form>
  );
}

function CustomerForm({ me }: { me: Me }) {
  const { saveCustomerProfile } = useAuth();
  const { run, footer } = useSave();
  const [c, setC] = useState<CustomerProfile>(me.customerProfile ?? { companyName: '', companySize: 'SOLO', website: null });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCustomerProfile(c));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className={`${LABEL} sm:col-span-2`}>
        Tên công ty / dự án
        <input maxLength={120} value={c.companyName} onChange={(e) => setC({ ...c, companyName: e.target.value })} placeholder="Để trống nếu bạn đặt đơn cá nhân" className={INPUT} />
      </label>
      <label className={LABEL}>
        Quy mô
        <select value={c.companySize} onChange={(e) => setC({ ...c, companySize: e.target.value as CompanySize })} className={INPUT}>
          {Object.entries(COMPANY_SIZE).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Website
        <input type="url" value={c.website ?? ''} onChange={(e) => setC({ ...c, website: emptyToNull(e.target.value) })} placeholder="https://…" className={INPUT} />
      </label>
      <div className="sm:col-span-2">{footer('Lưu hồ sơ doanh nghiệp')}</div>
    </form>
  );
}

function PrefsForm({ me }: { me: Me }) {
  const { updateMe } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { run, footer } = useSave();
  const [n, setN] = useState<NotificationPrefs>(me.notifications);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMe({ notifications: n }));
      }}
    >
      <div className="grid gap-2">
        {NOTIFY.map((x) => (
          <Toggle key={x.k} checked={n[x.k]} onChange={(v) => setN({ ...n, [x.k]: v })} label={x.label} text={x.text} />
        ))}
        {n.push && <PushDevice />}
      </div>
      <fieldset className="mt-5">
        <legend className={LABEL}>Đơn vị tiền tệ hiển thị</legend>
        <p className="text-xs text-slate-500">Lưu ngay khi chọn.</p>
        <div className="mt-2 flex gap-2">
          {(['VND', 'USD'] as const).map((c) => (
            <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${currency === c ? 'border-emerald bg-emerald/5' : 'border-slate-200'}`}>
              <input type="radio" name="currency" checked={currency === c} onChange={() => setCurrency(c)} className="accent-emerald" />
              {c === 'VND' ? 'VND (₫)' : 'USD ($)'}
            </label>
          ))}
        </div>
      </fieldset>
      {footer('Lưu thông báo')}
    </form>
  );
}

function SecurityForm({ me }: { me: Me }) {
  const { changePassword, logout, providers, oauthUrl } = useAuth();
  const { run, footer } = useSave();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [linkError] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('auth_error')));
  const linkable = (['github', 'google'] as const).filter((p) => providers[p]);
  return (
    <>
      <p className="text-sm text-slate-600">
        Đăng nhập bằng: <span className="font-semibold text-ink">{LOGIN_METHOD[me.loginMethod]}</span>
      </p>
      {me.hasPassword ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await changePassword(pw);
              setPw({ currentPassword: '', newPassword: '' });
            }, 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
          }}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <label className={LABEL}>
            Mật khẩu hiện tại
            <input type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            Mật khẩu mới
            <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className={INPUT} />
          </label>
          <div className="sm:col-span-2">{footer('Đổi mật khẩu')}</div>
        </form>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Mật khẩu do {LOGIN_METHOD[me.loginMethod]} quản lý.</p>
      )}
      {linkable.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink">Liên kết đăng nhập</p>
          <ul className="mt-2 space-y-2">
            {linkable.map((p) => (
              <li key={p} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span>{LOGIN_METHOD[p]}</span>
                {me.linkedProviders.includes(p) ? (
                  <span className="font-semibold text-emerald-dark">Đã liên kết</span>
                ) : (
                  <a href={oauthUrl(p, undefined, true)} className="font-semibold text-emerald-dark hover:underline">
                    Liên kết
                  </a>
                )}
              </li>
            ))}
          </ul>
          {linkError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {linkError === 'link_taken' ? 'Tài khoản này đã gắn với một tài khoản GrabCode khác.' : 'Liên kết chưa thành công, thử lại.'}
            </p>
          )}
        </div>
      )}
      <button type="button" onClick={() => logout()} className="btn-ghost mt-4 border border-slate-200 text-red-700">
        <span className="material-symbols-outlined !text-[18px]" aria-hidden>logout</span> Đăng xuất
      </button>
    </>
  );
}

function Settings() {
  const { me } = useAuth();

  if (!me) {
    // Mock mode (no NEXT_PUBLIC_API_URL): only the browser-local currency preference exists.
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="card text-sm text-slate-500">Chế độ demo: chưa kết nối API nên không có hồ sơ tài khoản.</p>
      </main>
    );
  }
  const isCoder = me.roles.includes('CODER');
  const isCustomer = me.roles.includes('CUSTOMER');

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr] md:px-8">
      <aside className="md:sticky md:top-20 md:self-start">
        <h1 className="font-display text-2xl font-extrabold text-ink">Cài đặt</h1>
        <nav className="mt-4 flex gap-1 overflow-x-auto md:flex-col" aria-label="Mục cài đặt">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-ink">
              <span className="material-symbols-outlined !text-[18px]" aria-hidden>{s.icon}</span>
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* key: remount forms when the server copy changes (e.g. after a role is added). */}
      <div className="grid min-w-0 gap-6" key={me.roles.join()}>
        <Section id="account" title="Thông tin liên hệ" text="Chỉ GrabCode và đối tác trong đơn hàng thấy số điện thoại của bạn.">
          <AccountForm me={me} />
        </Section>
        <Section id="coder" title="Hồ sơ Coder" text="Khách hàng và thuật toán matching dựa vào hồ sơ này để giao cuốc cho bạn.">
          {isCoder ? <CoderForm me={me} /> : <ActivateButton role="CODER" text="Muốn nhận cuốc đơn POC và kiếm thêm thu nhập? Bật vai trò Coder trên chính tài khoản này." />}
        </Section>
        <Section id="customer" title="Hồ sơ doanh nghiệp" text="Hiển thị cho Coder khi nhận đơn của bạn và trên hóa đơn.">
          {isCustomer ? <CustomerForm me={me} /> : <ActivateButton role="CUSTOMER" text="Cần thuê Coder làm POC? Bật vai trò Khách hàng trên chính tài khoản này." />}
        </Section>
        <Section id="prefs" title="Thông báo & hiển thị" text="Chọn kênh GrabCode được phép liên hệ bạn.">
          <PrefsForm me={me} />
        </Section>
        <Section id="security" title="Mật khẩu & bảo mật" text="Quản lý cách bạn đăng nhập.">
          <SecurityForm me={me} />
        </Section>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Navbar />
      <Settings />
    </RequireAuth>
  );
}
