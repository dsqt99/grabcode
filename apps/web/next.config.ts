import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

const CODER_ORIGIN = process.env.CODER_ORIGIN ?? 'http://localhost:3001';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3002';

// No framing (clickjacking on approve / pay buttons), no MIME sniffing, no full URLs leaked as Referer.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/**
 * A production build without the API would ship the local mock mode (seed orders, demo coder stats); without a support
 * channel the payment page cannot tell customers whom to call (UX spec Màn A-6). Both fail the build. `next dev` is unaffected.
 */
function requireProductionEnv() {
  const missing = [
    !process.env.NEXT_PUBLIC_API_URL && 'NEXT_PUBLIC_API_URL',
    !process.env.NEXT_PUBLIC_SUPPORT_ZALO && !process.env.NEXT_PUBLIC_SUPPORT_HOTLINE && 'NEXT_PUBLIC_SUPPORT_ZALO or NEXT_PUBLIC_SUPPORT_HOTLINE',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Production build needs ${missing.join(', ')} (see docs/DEPLOY.md).`);
}

const nextConfig: NextConfig = {
  transpilePackages: ['@grabcode/contracts', '@grabcode/auth-ui'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  // Proxy the Coder PWA under the same origin so BroadcastChannel/localStorage sync works.
  async rewrites() {
    return [
      { source: '/coder/:path*', destination: `${CODER_ORIGIN}/coder/:path*` },
      { source: '/admin/:path*', destination: `${ADMIN_ORIGIN}/admin/:path*` },
    ];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) requireProductionEnv();
  return nextConfig;
}
