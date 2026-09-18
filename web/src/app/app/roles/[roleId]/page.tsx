import type { Metadata } from 'next';
import { RoleWorkspace } from '@/features/role-workspace/role-workspace.index';

export const metadata: Metadata = { title: 'Role workspace' };

export default async function RolePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  return <RoleWorkspace roleId={roleId} />;
}
