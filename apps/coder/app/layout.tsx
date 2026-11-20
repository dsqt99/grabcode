import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { RequireAuth } from '@grabcode/auth-ui';
import { AuthProvider } from '@grabcode/auth-ui';
import ApprovalGate from '../components/ApprovalGate';
import { BRAND } from '@grabcode/contracts';


const jakarta = Plus_Jakarta_Sans({ subsets: ['latin', 'vietnamese'], weight: ['500', '600', '700', '800'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: `${BRAND.name} Coder — Nhận cuốc đơn`,
  description: `Ứng dụng cho freelancer ${BRAND.name}: nhận đơn, bàn giao theo mốc, rút tiền về ngân hàng.`,
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
          <RequireAuth role="CODER">
            <ApprovalGate>{children}</ApprovalGate>
          </RequireAuth>
        </AuthProvider>
      </body>
    </html>
  );
}
