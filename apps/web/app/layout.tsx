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
import { AuthProvider } from '@grabcode/auth-ui';
import Footer from '../components/Footer';
import { CurrencyProvider } from '../lib/currency';
import { BRAND } from '@grabcode/contracts';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: 'Đặt làm app cho shop và SME: AI soạn đặc tả, freelancer vibe code làm, tiền giữ ký quỹ và chỉ giải ngân khi bạn duyệt từng mốc.',
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
          <CurrencyProvider>
            {children}
            <Footer />
          </CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
