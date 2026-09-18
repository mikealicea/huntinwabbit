import type { Metadata } from 'next';
import { AuthPageContainer } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: PageProps<'/reset-password'>) {
  return (
    <AuthPageContainer mode="reset-password" searchParams={searchParams} />
  );
}
