import type { NextConfig } from 'next';

// Served behind the web app at /admin (same origin, so the gc_session cookie and CORS just work).
const nextConfig: NextConfig = {
  basePath: '/admin',
  transpilePackages: ['@grabcode/contracts'],
};

export default nextConfig;
