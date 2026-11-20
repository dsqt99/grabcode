import { BRAND } from '@grabcode/contracts';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: `${BRAND.name} Admin`, description: 'Vận hành: coder, tranh chấp, đối soát, rút tiền, hàng đợi.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
