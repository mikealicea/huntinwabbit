'use client';
import { useRouter } from 'next/navigation';
import { ChangeCompanyContainer } from '@/features/company-workspace/company-workspace.index';
import {
  postingApi,
  RequestFeedback,
  useDeletePostingMutation,
  useExtractPostingMutation,
  usePostingQuery,
  useUpdatePostingMutation,
} from '@/features/job-api/job-api.index';
import {
  type ApplicationFields,
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  toOpportunity,
} from '@/features/job-search/job-search.index';
import { selectToday, useAppSelector } from '@/state/state.index';
import { RoleNotFound } from './RoleNotFound.component';
import { RoleWorkspace } from './RoleWorkspace.component';
import { UnavailableSection } from './UnavailableSection.component';
import { UpdateRoleContainer } from './UpdateRole.container';
export function RoleWorkspaceContainer({ roleId }: { roleId: string }) {
  const router = useRouter();
  const [remove, deletion] = useDeletePostingMutation();
  const cached = postingApi.endpoints.posting.useQueryState(roleId);
  const pending = ['queued', 'processing'].includes(
    cached.data?.extraction.status ?? '',
  );
  const query = usePostingQuery(roleId, {
    pollingInterval: pending || cached.data?.edits?.pending ? 2000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const [update, mutation] = useUpdatePostingMutation();
  const [extract, extraction] = useExtractPostingMutation();
  const today = useAppSelector(selectToday);
  if (query.error && 'status' in query.error && query.error.status === 404)
    return <RoleNotFound />;
  if (!query.currentData)
    return (
      <RequestFeedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const role = toOpportunity(query.currentData);
  async function change(changes: Partial<ApplicationFields>) {
    if (!query.currentData || mutation.isLoading || deletion.isLoading)
      return false;
    try {
      await update({
        id: roleId,
        expectedApplicationVersion: query.currentData.applicationVersion,
        changes,
      }).unwrap();
      return true;
    } catch {
      return false;
    }
  }
  return (
    <>
      <RequestFeedback
        error={query.error ?? mutation.error ?? extraction.error}
        onRetry={() => {
          mutation.reset();
          extraction.reset();
          void query.refetch();
        }}
      />
      <RoleWorkspace
        key={role.id}
        role={role}
        roleName={getRoleTitle(role)}
        companyLabel={getCompanyLabel(role, [])}
        companyControl={
          <ChangeCompanyContainer
            posting={query.currentData}
            disabled={deletion.isLoading || mutation.isLoading}
          />
        }
        nextActionLabel={getNextAction(role, today).label}
        onApplicationChange={change}
        saving={mutation.isLoading || deletion.isLoading}
        deleting={deletion.isLoading}
        deleteDisabled={mutation.isLoading || extraction.isLoading}
        onDelete={async (expectedApplicationVersion) => {
          if (mutation.isLoading || extraction.isLoading || deletion.isLoading)
            return 'failed';
          try {
            await remove({ id: roleId, expectedApplicationVersion }).unwrap();
            router.replace('/app');
            return 'deleted';
          } catch (error) {
            if (
              typeof error === 'object' &&
              error &&
              'status' in error &&
              error.status === 409
            ) {
              await query.refetch();
              return 'conflict';
            }
            return 'failed';
          }
        }}
        extracting={extraction.isLoading || deletion.isLoading}
        onExtract={() => {
          if (
            query.currentData &&
            !deletion.isLoading &&
            !extraction.isLoading &&
            !pending
          )
            void extract({
              id: roleId,
              expectedGeneration: query.currentData.extraction.generation,
            });
        }}
        onTaskCompletionChange={() => {}}
        updates={
          <UpdateRoleContainer
            key={role.id}
            roleId={role.id}
            pending={!!role.saved?.edits?.pending}
            disabled={deletion.isLoading}
          />
        }
        materials={
          <UnavailableSection title="Application materials">
            Resume selection and submitted materials are not connected yet.
          </UnavailableSection>
        }
        company={
          <UnavailableSection title="Company research & contacts">
            Shared company research and contacts are not connected yet.
          </UnavailableSection>
        }
      />
    </>
  );
}
