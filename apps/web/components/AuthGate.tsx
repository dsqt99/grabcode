'use client';

import { useEffect, useState } from 'react';
import type { UserRole } from '@grabcode/contracts/schemas';
import { AuthError, useAuth } from '@grabcode/auth-ui';
import Navbar from './Navbar';
import Logo from './Logo';
import { BRAND } from '@grabcode/contracts';


const AUTH_ERRORS: Record<string, string> = {
  state: 'Phiên đăng nhập hết hạn hoặc không hợp lệ, vui lòng thử lại.',
  oauth: 'Không xác thực được tài khoản Google/GitHub, vui lòng thử lại.',
};
const FORM_ERRORS: Record<number, string> = {
  400: 'Email không hợp lệ hoặc mật khẩu dưới 8 ký tự.',
  401: 'Email hoặc mật khẩu không đúng.',
  409: 'Email đã được đăng ký, hãy đăng nhập.',
};
const INPUT = 'field';
const LABEL = 'font-display text-sm font-semibold text-stone-900';
const OAUTH_BTN = 'btn-outline w-full';

const ROLES: { role: UserRole; icon: string; title: string; text: string }[] = [
  { role: 'CUSTOMER', icon: 'business_center', title: 'Tôi cần thuê Coder', text: 'Đặt làm app, chuyển khoản trước, duyệt từng mốc' },
  { role: 'CODER', icon: 'code', title: 'Tôi là freelancer', text: 'Nhận việc làm app, kiếm thu nhập' },
];

/** Upwork-style role cards; the role is only chosen once, at sign-up. */
export function RolePicker({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="mb-2 font-display text-sm font-semibold text-stone-900">Bạn tham gia {BRAND.name} với vai trò</legend>
      {ROLES.map((r) => (
        <label
          key={r.role}
          className={`relative cursor-pointer rounded-2xl border p-4 transition ${
            value === r.role ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-stone-200 bg-white hover:border-stone-300'
          }`}
        >
          <input type="radio" name="role" value={r.role} checked={value === r.role} onChange={() => onChange(r.role)} className="absolute right-3 top-3 h-5 w-5 accent-brand-700" />
          <span className="material-symbols-outlined text-brand-700" aria-hidden>{r.icon}</span>
          <span className="mt-1 block pr-6 font-display text-sm font-bold text-stone-900">{r.title}</span>
          <span className="mt-0.5 block text-xs text-stone-600">{r.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** One login for both portals: one account can be Customer and Coder at the same time. */
export function LoginPanel({ defaultRole = 'CUSTOMER', className = '' }: { defaultRole?: UserRole; className?: string }) {
  const { providers, oauthUrl, register, passwordLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth callback redirects back with ?auth_error=state|oauth.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('auth_error');
    if (code) setError(AUTH_ERRORS[code] ?? AUTH_ERRORS.oauth);
  }, []);

  const isRegister = mode === 'register';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (isRegister ? register({ ...form, role }) : passwordLogin({ email: form.email, password: form.password }));
    } catch (err) {
      setError((err instanceof AuthError && FORM_ERRORS[err.status]) || 'Không kết nối được máy chủ, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };
  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  };
  // Sign-up via OAuth carries the picked role; plain login keeps the account's roles.
  const oauthRole = isRegister ? role : undefined;

  return (
    <section className={`card w-full ${className}`}>
      <h1 className="font-display text-2xl font-extrabold text-stone-900 md:text-3xl">{isRegister ? `Tạo tài khoản ${BRAND.name}` : `Đăng nhập ${BRAND.name}`}</h1>
      <p className="mt-1 text-stone-600">
        {isRegister ? 'Một tài khoản dùng cho cả Khách hàng và Coder.' : 'Dùng chung cho cổng Khách hàng và ứng dụng Coder.'}
      </p>

      {error && (
        <p className="banner-danger mt-4" role="alert">
          <span className="material-symbols-outlined !text-[20px]" aria-hidden>error</span>
          {error}
        </p>
      )}

      {isRegister && (
        <div className="mt-5">
          <RolePicker value={role} onChange={setRole} />
        </div>
      )}

      {providers.password && (
        <form onSubmit={submit} className="mt-5 grid gap-4">
          {isRegister && (
            <label className={LABEL}>
              Họ tên
              <input
                required
                maxLength={80}
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`${INPUT} mt-1.5 font-sans font-normal`}
              />
            </label>
          )}
          <label className={LABEL}>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`${INPUT} mt-1.5 font-sans font-normal`}
            />
          </label>
          <label className={LABEL}>
            Mật khẩu
            <span className="relative mt-1.5 block">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={isRegister ? 8 : 1}
              maxLength={128}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`${INPUT} pr-12 font-sans font-normal`}
            />
            <button
              type="button"
              className="btn-icon absolute right-0.5 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <span className="material-symbols-outlined !text-[20px]" aria-hidden>{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
            </span>
            {isRegister && <span className="help font-sans font-normal">Tối thiểu 8 ký tự.</span>}
          </label>
          <button type="submit" disabled={busy} className="btn-primary mt-1 w-full">
            {busy ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>
      )}

      {(providers.google || providers.github) && (
        <>
          {providers.password && (
            <div className="my-5 flex items-center gap-3 text-sm text-stone-500" aria-hidden>
              <span className="h-px flex-1 bg-stone-200" /> hoặc <span className="h-px flex-1 bg-stone-200" />
            </div>
          )}
          <div className="grid gap-2">
            {providers.google && (
              <a href={oauthUrl('google', oauthRole)} className={OAUTH_BTN}>
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                  <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                </svg>
                Tiếp tục với Google
              </a>
            )}
            {providers.github && (
              <a href={oauthUrl('github', oauthRole)} className={OAUTH_BTN}>
                <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Tiếp tục với GitHub
              </a>
            )}
          </div>
        </>
      )}

      {providers.password && (
        <p className="mt-6 border-t border-stone-200 pt-4 text-center text-sm text-stone-600">
          {isRegister ? 'Đã có tài khoản?' : `Chưa có tài khoản ${BRAND.name}?`}{' '}
          <button type="button" onClick={switchMode} className="inline-flex min-h-[44px] items-center font-semibold text-brand-800 hover:underline">
            {isRegister ? 'Đăng nhập' : 'Đăng ký miễn phí'}
          </button>
        </p>
      )}
    </section>
  );
}

const PERKS = [
  { icon: 'storefront', text: 'Chủ shop / SME: đăng yêu cầu, duyệt từng mốc rồi mới trả tiền' },
  { icon: 'shield_lock', text: 'Tiền giữ ký quỹ, tranh chấp có admin xử lý' },
  { icon: 'payments', text: 'Freelancer vibe code: nhận việc, bàn giao theo mốc, rút tiền về ngân hàng' },
];

/** Full-width login banner: brand pitch on the left, sign-in panel on the right (form first on mobile). */
export function LoginBanner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-8 lg:grid-cols-2 lg:items-stretch lg:gap-8 lg:py-14">
        <section className="rounded-3xl bg-ink p-6 text-white md:p-10">
          <Logo tone="dark" />
          <h2 className="mt-6 text-balance font-display text-2xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {BRAND.tagline}
          </h2>
          <p className="mt-2 font-display text-lg font-bold text-brand-300 md:text-xl">Duyệt từng mốc rồi mới trả tiền.</p>
          <p className="mt-3 text-stone-300">Một tài khoản cho cả người đặt đơn và freelancer nhận đơn.</p>
          {/* Hidden on phones: the form comes first there and this list only made the page longer. */}
          <ul className="mt-8 hidden space-y-4 md:block">
            {PERKS.map((p) => (
              <li key={p.icon} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand-300">
                  <span className="material-symbols-outlined !text-[20px]" aria-hidden>{p.icon}</span>
                </span>
                <span className="text-sm text-stone-100">{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="order-first flex flex-col justify-center lg:order-none">{children}</div>
      </main>
    </>
  );
}
