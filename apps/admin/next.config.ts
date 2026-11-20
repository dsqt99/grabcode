import type { NextConfig } from 'next';

// No framing (clickjacking on approve / pay buttons), no MIME sniffing, no full URLs leaked as Referer.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// Served behind the web app at /admin (same origin, so the gc_session cookie and CORS just work).
const nextConfig: NextConfig = {
  basePath: '/admin',
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  transpilePackages: ['@grabcode/contracts'],
};

export default nextConfig;
