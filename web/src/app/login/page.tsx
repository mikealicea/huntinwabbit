import type { Metadata } from 'next';
import { AuthPage } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: PageProps<'/login'>) {
  return <AuthPage mode="login" searchParams={searchParams} />;
}
