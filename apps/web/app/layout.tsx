import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@grabcode/auth-ui';
import { CurrencyProvider } from '../lib/currency';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin', 'vietnamese'], weight: ['500', '600', '700', '800'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'GrabCode — Đặt POC như đặt đồ ăn',
  description: 'Sàn dispatch code siêu tốc: có demo chạy thật trong 2–8 giờ.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} ${inter.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body>
        <AuthProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
