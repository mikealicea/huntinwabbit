import type { Metadata } from 'next';
import { AuthPageContainer } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: PageProps<'/forgot-password'>) {
  return (
    <AuthPageContainer mode="forgot-password" searchParams={searchParams} />
  );
}
