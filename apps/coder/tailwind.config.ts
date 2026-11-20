import type { Config } from 'tailwindcss';

// FastDemo Design System tokens (see /DESIGN.md)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/auth-ui/src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        surface: '#FFFBF7',
        'surface-dim': '#E8D3C0',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#FFF4EA',
        'surface-container': '#FFEBD9',
        'surface-container-high': '#FFE2C7',
        'surface-container-highest': '#FFD9B8',
        'on-surface': '#1C1917',
        'on-surface-variant': '#3d4256',
        'inverse-surface': '#292524',
        outline: '#6b7280',
        'outline-variant': '#c7cbd9',
        primary: '#9A3412',
        'on-primary': '#ffffff',
        'primary-container': '#EA580C',
        'on-primary-container': '#431407',
        'inverse-primary': '#FDBA74',
        'primary-fixed': '#FED7AA',
        secondary: '#565e74',
        'secondary-container': '#dae2fd',
        tertiary: '#855300',
        'tertiary-container': '#d68900',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        // brand-strong: primary button background (white text 5.2:1). emerald.dark is for text, also on mint / slate-50 backgrounds (AA).
        // emerald (#EA580C): white text only 3.6:1 (large text/icons only), 4.8:1 on ink; for body text on dark use inverse-primary.
        'brand-strong': '#C2410C',
        emerald: { DEFAULT: '#EA580C', dark: '#9A3412', mint: '#FFF7ED', mintHover: '#FFEDD5' },
        ink: { DEFAULT: "#1C1917", soft: "#292524" },
        amber: { DEFAULT: '#F59E0B', tint: '#FEF3C7', text: '#92400E' },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
      boxShadow: {
        l2: '0px 4px 16px -2px rgba(15,23,42,0.06), 0px 2px 6px -1px rgba(234,88,12,0.04)',
        l3: '0px 12px 32px -4px rgba(15,23,42,0.12), 0px 4px 12px -2px rgba(15,23,42,0.04)',
        l4: '0px 20px 40px -8px rgba(15,23,42,0.16)',
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
