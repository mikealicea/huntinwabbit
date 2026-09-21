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
  title: {
    default: 'huntinwabbit-boilerplate',
    template: '%s · huntinwabbit-boilerplate',
  },
  description: 'An authenticated web and Serverless API starter.',
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
