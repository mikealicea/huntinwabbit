import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { createSampleState } from './job-search.fixtures';
import type {
  ApplicationFields,
  CapturedLink,
  Stage,
} from './job-search.types';

const jobSearchSlice = createSlice({
  name: 'jobSearch',
  initialState: createSampleState,
  reducers: {
    linksCaptured(state, action: PayloadAction<CapturedLink[]>) {
      for (const link of action.payload) {
        state.opportunities.push({
          id: link.id,
          sourceUrl: link.sourceUrl,
          companyId: null,
          posting: null,
          stage: 'collected',
          interest: link.interest,
          priority: 'not-set',
          followUpOn: null,
          notes: '',
          plannedResumeId: null,
          submittedMaterial: null,
          tasks: [
            {
              id: `${link.id}-referral`,
              kind: 'referral',
              label: 'Find referral',
              completed: false,
            },
          ],
        });
      }
    },
    applicationUpdated(
      state,
      action: PayloadAction<{
        id: string;
        changes: Partial<ApplicationFields>;
      }>,
    ) {
      const role = state.opportunities.find(
        (item) => item.id === action.payload.id,
      );
      if (role) Object.assign(role, action.payload.changes);
    },
    taskCompletionSet(
      state,
      action: PayloadAction<{ id: string; taskId: string; completed: boolean }>,
    ) {
      const role = state.opportunities.find(
        (item) => item.id === action.payload.id,
      );
      const task = role?.tasks.find(
        (item) => item.id === action.payload.taskId,
      );
      if (task) task.completed = action.payload.completed;
    },
  },
  selectors: {
    selectOpportunities: (state) => state.opportunities,
    selectCompanies: (state) => state.companies,
    selectResumes: (state) => state.resumes,
    selectOpportunity: (state, id: string) =>
      state.opportunities.find((role) => role.id === id),
    selectCompany: (state, id: string | null) =>
      state.companies.find((company) => company.id === id),
  },
});

export const { linksCaptured, applicationUpdated, taskCompletionSet } =
  jobSearchSlice.actions;
export const jobSearchReducer = jobSearchSlice.reducer;
export const {
  selectOpportunities,
  selectCompanies,
  selectResumes,
  selectOpportunity,
  selectCompany,
} = jobSearchSlice.selectors;

export const selectActiveRoleCount = createSelector(
  [selectOpportunities],
  (roles) => roles.filter((role) => role.stage !== 'closed').length,
);
export const selectRolesByStage = createSelector(
  [
    selectOpportunities,
    (
      _state: { jobSearch: ReturnType<typeof jobSearchReducer> },
      stage: Stage,
    ) => stage,
  ],
  (roles, stage) => roles.filter((role) => role.stage === stage),
);
export const selectCompanyRoleCount = createSelector(
  [
    selectOpportunities,
    (
      _state: { jobSearch: ReturnType<typeof jobSearchReducer> },
      companyId: string | null,
    ) => companyId,
  ],
  (roles, companyId) =>
    roles.filter((role) => role.companyId === companyId).length,
);
