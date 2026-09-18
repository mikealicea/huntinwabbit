'use client';
import {
  applicationUpdated,
  type Opportunity,
  selectResumes,
} from '@/features/job-search/job-search.index';
import { useAppDispatch, useAppSelector } from '@/state/state.index';
import { ApplicationMaterials } from './ApplicationMaterials.component';
export function ApplicationMaterialsContainer({ role }: { role: Opportunity }) {
  const dispatch = useAppDispatch();
  const resumes = useAppSelector(selectResumes);
  return (
    <ApplicationMaterials
      role={role}
      resumes={resumes}
      onResumeChange={(plannedResumeId) =>
        dispatch(
          applicationUpdated({ id: role.id, changes: { plannedResumeId } }),
        )
      }
    />
  );
}
