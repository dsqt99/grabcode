import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GrabCode Coder',
    short_name: 'GrabCode Coder',
    description: 'Nhận cuốc đơn, build POC, nhận tiền ngay.',
    start_url: '/coder',
    scope: '/coder',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#00B14F',
    icons: [{ src: '/coder/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
