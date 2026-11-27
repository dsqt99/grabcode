import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Ai Code AI redesign tokens (HON-51 redesign-spec). Same block in apps/web, apps/coder, apps/admin.
      colors: {
        brand: { 50: '#EEF4FF', 100: '#DCE8FF', 200: '#BAD1FF', 300: '#8DB2FF', 400: '#5A8BFA', 500: '#2F66EA', 600: '#0B44CC', 700: '#0A38A8', 800: '#0C2F85', 900: '#0D2766' },
        ink: { DEFAULT: '#1C1917', soft: '#292524' },
        'line-strong': '#8A817C',
        // --- legacy aliases: keep until every screen of the app is redesigned, then delete (P1 cleanup) ---
        'brand-strong': '#0A38A8', primary: '#0C2F85', 'primary-fixed': '#BAD1FF', 'inverse-primary': '#8DB2FF',
        emerald: { DEFAULT: '#0B44CC', dark: '#0C2F85', mint: '#EEF4FF', mintHover: '#DCE8FF' },
        amber: { DEFAULT: '#F59E0B', tint: '#FEF3C7', text: '#92400E' },
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
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: { pop: 'pop 0.25s cubic-bezier(0.34,1.56,0.64,1)' },
    },
  },
  plugins: [],
};

export default config;
