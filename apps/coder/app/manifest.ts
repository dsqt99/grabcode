import type { MetadataRoute } from 'next';
import { BRAND } from '@grabcode/contracts';


export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} Coder`,
    short_name: `${BRAND.name} Coder`,
    description: 'Nhận đơn, làm app bằng công cụ AI, rút tiền về ngân hàng.',
    start_url: '/coder',
    scope: '/coder',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4F46E5',
    icons: [{ src: '/coder/icon.png', sizes: '256x256', type: 'image/png', purpose: 'any' }],
  };
}
