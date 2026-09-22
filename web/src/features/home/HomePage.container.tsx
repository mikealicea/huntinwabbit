import { redirect } from 'next/navigation';
import { serverIdentity } from '@/features/auth/auth.server.index';

export async function HomePageContainer() {
  const identity = await serverIdentity();
  if (identity.status === 'unavailable')
    redirect('/auth/unavailable?next=%2Fapp');
  return redirect(identity.status === 'authenticated' ? '/app' : '/login');
}
