import type { Metadata } from 'next';
import { AuthConfirmationPage } from '@/features/auth/auth.server.index';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Confirm email',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({
  searchParams,
}: PageProps<'/auth/confirm'>) {
  return <AuthConfirmationPage searchParams={searchParams} />;
}
