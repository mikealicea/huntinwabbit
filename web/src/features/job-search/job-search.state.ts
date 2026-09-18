import type {
  JobSearchAction,
  JobSearchState,
  Opportunity,
} from './job-search.types';

export function jobSearchReducer(
  state: JobSearchState,
  action: JobSearchAction,
): JobSearchState {
  if (action.type === 'capture') {
    const additions: Opportunity[] = action.links.map((link) => ({
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
    }));
    return { ...state, opportunities: [...state.opportunities, ...additions] };
  }
  return {
    ...state,
    opportunities: state.opportunities.map((role) => {
      if (role.id !== action.id) return role;
      if (action.type === 'update-application')
        return { ...role, ...action.changes };
      return {
        ...role,
        tasks: role.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, completed: action.completed }
            : task,
        ),
      };
    }),
  };
}
