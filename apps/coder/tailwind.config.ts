import type { Config } from 'tailwindcss';

// Emerald Mobility Design System tokens (see /DESIGN.md)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f8f9ff',
        'surface-dim': '#cbdbf5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#3d4a3d',
        'inverse-surface': '#213145',
        outline: '#6d7b6c',
        'outline-variant': '#bccbb9',
        primary: '#006e2e',
        'on-primary': '#ffffff',
        'primary-container': '#00b14f',
        'on-primary-container': '#003a15',
        'inverse-primary': '#52e078',
        'primary-fixed': '#71fe91',
        secondary: '#565e74',
        'secondary-container': '#dae2fd',
        tertiary: '#855300',
        'tertiary-container': '#d68900',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        emerald: { DEFAULT: '#00B14F', dark: '#00873D', mint: '#E8F8EE', mintHover: '#D4F2DE' },
        ink: { DEFAULT: '#0F172A', soft: '#1E293B' },
        amber: { DEFAULT: '#F59E0B', tint: '#FEF3C7', text: '#B45309' },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
      boxShadow: {
        l2: '0px 4px 16px -2px rgba(15,23,42,0.06), 0px 2px 6px -1px rgba(0,177,79,0.04)',
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
