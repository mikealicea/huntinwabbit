import type { Metadata } from 'next';
import { AuthPage } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: PageProps<'/reset-password'>) {
  return <AuthPage mode="reset-password" searchParams={searchParams} />;
}
