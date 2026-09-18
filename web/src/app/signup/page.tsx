import type { Metadata } from 'next';
import { AuthPage } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: PageProps<'/signup'>) {
  return <AuthPage mode="signup" searchParams={searchParams} />;
}
