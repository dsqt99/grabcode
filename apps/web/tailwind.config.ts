import type { Config } from 'tailwindcss';

// Ai Code AI redesign tokens (HON-51 redesign-spec). Same block in apps/web, apps/coder, apps/admin.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/auth-ui/src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412', 900: '#7C2D12' },
        ink: { DEFAULT: '#1C1917', soft: '#292524' },
        'line-strong': '#8A817C',
        // --- legacy aliases: keep until every screen of the app is redesigned, then delete (P1 cleanup) ---
        'brand-strong': '#C2410C', primary: '#9A3412', 'primary-fixed': '#FED7AA', 'inverse-primary': '#FDBA74',
        emerald: { DEFAULT: '#EA580C', dark: '#9A3412', mint: '#FFF7ED', mintHover: '#FFEDD5' },
        amber: { DEFAULT: '#F59E0B', tint: '#FEF3C7', text: '#92400E' }, // extend merges with Tailwind's amber scale
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        raised: '0 1px 2px rgba(28,25,23,0.06), 0 4px 12px -2px rgba(28,25,23,0.08)',
        overlay: '0 20px 48px -12px rgba(28,25,23,0.28)',
        sheet: '0 -8px 32px -8px rgba(28,25,23,0.20)',
        // legacy
        l2: '0 1px 2px rgba(28,25,23,0.06), 0 4px 12px -2px rgba(28,25,23,0.08)', l3: '0 20px 48px -12px rgba(28,25,23,0.28)', l4: '0 20px 48px -12px rgba(28,25,23,0.28)',
      },
      keyframes: {
        sonar: { '0%': { transform: 'scale(0.4)', opacity: '0.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: { sonar: 'sonar 2.4s ease-out infinite', pop: 'pop 0.25s cubic-bezier(0.34,1.56,0.64,1)' },
    },
  },
  plugins: [],
};

export default config;
