import './globals.css';
import type { Metadata } from 'next';
import { Ubuntu, Ubuntu_Mono } from 'next/font/google';
import { Header } from '@/features/header/header.index';
import { AppThemeProvider } from '@/features/theme/theme.index';
import { PageShell } from '@/shared/shared.index';

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
  title: 'Hello world',
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
        <AppThemeProvider>
          <Header />
          <PageShell>{children}</PageShell>
        </AppThemeProvider>
      </body>
    </html>
  );
}
