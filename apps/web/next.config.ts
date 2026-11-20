import type { NextConfig } from 'next';

const CODER_ORIGIN = process.env.CODER_ORIGIN ?? 'http://localhost:3001';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3002';

// No framing (clickjacking on approve / pay buttons), no MIME sniffing, no full URLs leaked as Referer.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@grabcode/contracts', '@grabcode/auth-ui'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
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

export default nextConfig;
