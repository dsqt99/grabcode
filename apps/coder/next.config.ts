import type { NextConfig } from 'next';

// basePath lets the web app proxy /coder/* so both apps share ONE origin
// (required for BroadcastChannel / localStorage cross-app sync).
const nextConfig: NextConfig = {
  basePath: '/coder',
  transpilePackages: ['@grabcode/contracts', '@grabcode/auth-ui'],
};

export default nextConfig;
