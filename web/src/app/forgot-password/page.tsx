import type { Metadata } from 'next';
import { AuthPage } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: PageProps<'/forgot-password'>) {
  return <AuthPage mode="forgot-password" searchParams={searchParams} />;
}
