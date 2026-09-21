import type { Metadata } from 'next';
import { AuthUnavailablePageContainer } from '@/features/auth/auth.server.index';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Unable to connect',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({
  searchParams,
}: PageProps<'/auth/unavailable'>) {
  return <AuthUnavailablePageContainer searchParams={searchParams} />;
}
