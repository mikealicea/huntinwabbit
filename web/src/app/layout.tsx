import './globals.css';
import type { Metadata } from 'next';
import { Ubuntu, Ubuntu_Mono } from 'next/font/google';
import { AppThemeProvider } from '@/features/theme/theme.index';

const ubuntuSans = Ubuntu({
  weight: ['300', '400', '500', '700'],
  variable: '--font-ubuntu-sans',
  subsets: ['latin'],
});

const ubuntuMono = Ubuntu_Mono({
  weight: ['400', '700'],
  variable: '--font-ubuntu-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  title: { default: 'huntinwabbit', template: '%s · huntinwabbit' },
  description: 'A personal workspace for your job search.',
  openGraph: {
    type: 'website',
    siteName: 'huntinwabbit',
    images: [
      {
        url: '/brand/og-light.jpg',
        width: 1200,
        height: 630,
        alt: 'huntinwabbit — a personal workspace for your job search',
      },
      {
        url: '/brand/og-dark.jpg',
        width: 1200,
        height: 630,
        alt: 'huntinwabbit — a personal workspace for your job search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: '/brand/og-light.jpg',
        alt: 'huntinwabbit — a personal workspace for your job search',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${ubuntuSans.variable} ${ubuntuMono.variable} bg-base-100 text-base-content min-h-screen font-sans antialiased`}
      >
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
