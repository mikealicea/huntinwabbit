import type { Metadata } from 'next';
import { requireUser } from '@/features/auth/auth.server.index';
import { CompanyWorkspaceContainer } from '@/features/company-workspace/company-workspace.index';
export const metadata: Metadata = { title: 'Company workspace' };
export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await requireUser(`/app/companies/${encodeURIComponent(companyId)}`);
  return <CompanyWorkspaceContainer companyId={companyId} />;
}
