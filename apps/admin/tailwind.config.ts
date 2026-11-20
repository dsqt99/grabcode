import type { Config } from 'tailwindcss';

// Brand button colours (.btn), same values as apps/web/tailwind.config.ts.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#9A3412',
        'brand-strong': '#C2410C',
      },
    },
  },
  plugins: [],
};

export default config;
