import { BRAND } from '@grabcode/contracts';
import type { Metadata } from 'next';
// Fonts tự host qua @fontsource: build không phụ thuộc mạng tới Google Fonts (deploy-staging run #21).
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './globals.css';

export const metadata: Metadata = { title: `${BRAND.name} Admin`, description: 'Vận hành: coder, tranh chấp, đối soát, rút tiền, hàng đợi.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
