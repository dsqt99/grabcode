import type { MetadataRoute } from 'next';
import { BRAND } from '@grabcode/contracts';


export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} Coder`,
    short_name: `${BRAND.name} Coder`,
    description: 'Nhận đơn POC/demo ngắn, làm bằng công cụ AI, rút tiền về ngân hàng.',
    start_url: '/coder',
    scope: '/coder',
    display: 'standalone',
    background_color: '#FAFAF9',
    theme_color: '#C2410C',
    // public/ is served under basePath /coder.
    icons: [
      { src: '/coder/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/coder/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/coder/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
