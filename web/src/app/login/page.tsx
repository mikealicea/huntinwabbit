import type { Metadata } from 'next';
import { AuthPageContainer } from '@/features/auth/auth.server.index';

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: PageProps<'/login'>) {
  return <AuthPageContainer mode="login" searchParams={searchParams} />;
}
