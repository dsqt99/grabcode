import type { NextConfig } from 'next';

const CODER_ORIGIN = process.env.CODER_ORIGIN ?? 'http://localhost:3001';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3002';

const nextConfig: NextConfig = {
  transpilePackages: ['@grabcode/contracts', '@grabcode/auth-ui'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  // Proxy the Coder PWA under the same origin so BroadcastChannel/localStorage sync works.
  async rewrites() {
    return [
      { source: '/coder/:path*', destination: `${CODER_ORIGIN}/coder/:path*` },
      { source: '/admin/:path*', destination: `${ADMIN_ORIGIN}/admin/:path*` },
    ];
  },
};

export default nextConfig;
