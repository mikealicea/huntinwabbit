'use client';

import {
  type Opportunity,
  selectCompany,
  selectCompanyRoleCount,
} from '@/features/job-search/job-search.index';

import { useAppSelector } from '@/state/state.index';

import { CompanyContext } from './CompanyContext.component';
export function CompanyContextContainer({ role }: { role: Opportunity }) {
  const company = useAppSelector((state) =>
    selectCompany(state, role.companyId),
  );
  const roleCount = useAppSelector((state) =>
    selectCompanyRoleCount(state, role.companyId),
  );
  return <CompanyContext company={company} roleCount={roleCount} />;
}
