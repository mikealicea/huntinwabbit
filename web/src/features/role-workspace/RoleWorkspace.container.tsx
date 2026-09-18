'use client';
import {
  applicationUpdated,
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  selectCompanies,
  selectOpportunity,
  taskCompletionSet,
} from '@/features/job-search/job-search.index';
import {
  selectToday,
  useAppDispatch,
  useAppSelector,
} from '@/state/state.index';
import { ApplicationMaterialsContainer } from './ApplicationMaterials.container';
import { CompanyContextContainer } from './CompanyContext.container';
import { RoleNotFound } from './RoleNotFound.component';
import { RoleWorkspace } from './RoleWorkspace.component';
export function RoleWorkspaceContainer({ roleId }: { roleId: string }) {
  const dispatch = useAppDispatch();
  const today = useAppSelector(selectToday);
  const companies = useAppSelector(selectCompanies);
  const role = useAppSelector((state) => selectOpportunity(state, roleId));
  if (!role) return <RoleNotFound />;
  return (
    <RoleWorkspace
      role={role}
      roleName={getRoleTitle(role)}
      companyLabel={getCompanyLabel(role, companies)}
      nextActionLabel={getNextAction(role, today).label}
      onApplicationChange={(changes) =>
        dispatch(applicationUpdated({ id: roleId, changes }))
      }
      onTaskCompletionChange={(taskId, completed) =>
        dispatch(taskCompletionSet({ id: roleId, taskId, completed }))
      }
      materials={<ApplicationMaterialsContainer role={role} />}
      company={<CompanyContextContainer role={role} />}
    />
  );
}
