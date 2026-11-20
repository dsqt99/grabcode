import type { NextConfig } from 'next';

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

export default nextConfig;
