import type { Config } from 'tailwindcss';

// Brand button colours (.btn), same values as apps/web/tailwind.config.ts.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3730a3',
        'brand-strong': '#4338CA',
      },
    },
  },
  plugins: [],
};

export default config;
