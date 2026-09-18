import type { Metadata } from 'next';
import { requireUser } from '@/features/auth/auth.server.index';
import { RoleWorkspace } from '@/features/role-workspace/role-workspace.index';

export const metadata: Metadata = { title: 'Role workspace' };

export default async function RolePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  await requireUser(`/app/roles/${encodeURIComponent(roleId)}`);
  return <RoleWorkspace roleId={roleId} />;
}
