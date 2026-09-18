export const STAGES = [
  'collected',
  'applied',
  'preparing',
  'interviewing',
  'offer',
  'closed',
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  collected: 'Collected',
  applied: 'Applied',
  preparing: 'Preparing',
  interviewing: 'Interviewing',
  offer: 'Offer',
  closed: 'Closed',
};
export const INTERESTS = [
  'not-set',
  'throwaway',
  'interested',
  'highly-interested',
] as const;
export type Interest = (typeof INTERESTS)[number];
export const INTEREST_LABELS: Record<Interest, string> = {
  'not-set': 'Not set',
  throwaway: 'Throwaway',
  interested: 'Interested',
  'highly-interested': 'Highly interested',
};
export const PRIORITIES = ['not-set', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  'not-set': 'Not set',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface SalaryRange {
  minimum: number | null;
  maximum: number | null;
  currency: string;
  period: 'year' | 'month' | 'hour';
}

// Posting facts are separate from application choices. A future parser can supply
// these facts without replacing the user's workflow state.
export interface PostingDetails {
  title: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  requirements: string[];
  salary: SalaryRange | null;
}

export interface Company {
  id: string;
  name: string;
  research: string | null;
  interviewLoop: string | null;
  contacts: { id: string; name: string; relationship: string }[];
}

export interface Resume {
  id: string;
  label: string;
}

export interface SubmittedMaterial {
  readonly fileName: string;
  readonly resumeLabel: string;
  readonly submittedOn: string;
}

export interface RoleTask {
  id: string;
  kind: 'referral' | 'preparation';
  label: string;
  completed: boolean;
}

export interface ApplicationFields {
  stage: Stage;
  interest: Interest;
  priority: Priority;
  followUpOn: string | null;
  notes: string;
  plannedResumeId: string | null;
}

export interface Opportunity extends ApplicationFields {
  id: string;
  sourceUrl: string | null;
  companyId: string | null;
  posting: PostingDetails | null;
  tasks: RoleTask[];
  submittedMaterial: SubmittedMaterial | null;
}

export interface JobSearchState {
  opportunities: Opportunity[];
  companies: Company[];
  resumes: Resume[];
}

export interface CapturedLink {
  id: string;
  sourceUrl: string;
  interest: Interest;
}

export type JobSearchAction =
  | { type: 'capture'; links: CapturedLink[] }
  | {
      type: 'update-application';
      id: string;
      changes: Partial<ApplicationFields>;
    }
  | {
      type: 'set-task-completed';
      id: string;
      taskId: string;
      completed: boolean;
    };
