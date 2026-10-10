import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { NotificationProvider } from '@/lib/notification-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  metadataBase: new URL('https://wealthiq-nine.vercel.app'),
  title: 'WealthIQ — Understand Your Financial Health',
  description:
    'WealthIQ provides intelligent personal financial intelligence with smart Indian transaction classification, transparent health scoring, and multi-year forecasting.',
  openGraph: {
    title: 'WealthIQ — Intelligent Personal Financial Platform',
    description:
      'Intelligent financial intelligence with smart transaction classification, deterministic health scoring, and long-term net worth forecasting.',
    images: [
      {
        url: '/icon.svg',
        width: 1200,
        height: 630,
        alt: 'WealthIQ Financial Platform',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'WealthIQ — Understand Your Financial Health',
    description:
      'Intelligent financial intelligence with smart transaction classification, deterministic health scoring, and long-term net worth forecasting.',
    images: ['/icon.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <AuthProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
