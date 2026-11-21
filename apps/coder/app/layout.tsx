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
import { RequireAuth } from '@grabcode/auth-ui';
import { AuthProvider } from '@grabcode/auth-ui';
import ApprovalGate from '../components/ApprovalGate';
import { BRAND } from '@grabcode/contracts';

export const metadata: Metadata = {
  title: `${BRAND.name} Coder — Nhận đơn`,
  description: `Ứng dụng cho freelancer ${BRAND.name}: nhận đơn, bàn giao theo mốc, rút tiền về ngân hàng.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
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
