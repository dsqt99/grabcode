import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

// No framing (clickjacking on approve / pay buttons), no MIME sniffing, no full URLs leaked as Referer.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// basePath lets the web app proxy /coder/* so both apps share ONE origin
// (required for BroadcastChannel / localStorage cross-app sync).
const nextConfig: NextConfig = {
  basePath: '/coder',
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  transpilePackages: ['@grabcode/contracts', '@grabcode/auth-ui'],
};

/** A production build without the API would ship the local mock mode (seed wallet, simulated offers): fail it. */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.NEXT_PUBLIC_API_URL) throw new Error('Production build needs NEXT_PUBLIC_API_URL (see docs/DEPLOY.md).');
  return nextConfig;
}
