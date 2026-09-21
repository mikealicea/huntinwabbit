import type { JobSearchState, Opportunity } from './job-search.types';

function sampleRole(
  id: string,
  companyId: string,
  title: string,
  overrides: Partial<Opportunity> = {},
): Opportunity {
  return {
    id,
    companyId,
    sourceUrl: `https://example.com/jobs/${id}`,
    posting: {
      title,
      location: 'Remote · United States',
      employmentType: 'Full time',
      description:
        'Build thoughtful customer-facing products with a small, collaborative engineering team. Work closely with design and own delivery from an early idea through release.',
      requirements: [
        'Product development and API design',
        'Clear communication across engineering and design',
        'Experience delivering reliable software',
      ],
      salary: {
        minimum: 170000,
        maximum: 210000,
        currency: 'USD',
        period: 'year',
      },
    },
    stage: 'collected',
    interest: 'highly-interested',
    priority: 'high',
    followUpOn: null,
    notes: '',
    plannedResumeId: 'product-v3',
    submittedMaterial: null,
    tasks: [
      {
        id: `${id}-referral`,
        kind: 'referral',
        label: 'Find referral',
        completed: false,
      },
    ],
    ...overrides,
  };
}

// Return fresh objects for each provider/test; sample edits must never mutate a
// module-level singleton or leak into another browser request.
export function createSampleState(): JobSearchState {
  const juniper = sampleRole(
    'juniper-full-stack',
    'juniper',
    'Full Stack Engineer',
    {
      interest: 'not-set',
      priority: 'not-set',
      plannedResumeId: null,
    },
  );
  if (juniper.posting) juniper.posting.salary = null;
  const platform = sampleRole(
    'northstar-platform',
    'northstar',
    'Platform Engineer',
    {
      stage: 'preparing',
      plannedResumeId: 'platform-v2',
      submittedMaterial: {
        fileName: 'platform-engineering-v2.pdf',
        resumeLabel: 'Platform engineering · v2',
        submittedOn: '2026-09-10',
      },
      tasks: [
        {
          id: 'platform-referral',
          kind: 'referral',
          label: 'Find referral',
          completed: true,
        },
        {
          id: 'platform-prep',
          kind: 'preparation',
          label: 'Prepare for technical screen',
          completed: false,
        },
      ],
    },
  );
  if (platform.posting)
    platform.posting.salary = {
      minimum: 180000,
      maximum: 225000,
      currency: 'USD',
      period: 'year',
    };
  const fieldwork = sampleRole(
    'fieldwork-software',
    'fieldwork',
    'Software Engineer',
    {
      stage: 'applied',
      interest: 'throwaway',
      priority: 'low',
      followUpOn: '2026-09-17',
      plannedResumeId: 'general-v5',
      submittedMaterial: {
        fileName: 'general-resume-v5.pdf',
        resumeLabel: 'General resume · v5',
        submittedOn: '2026-09-08',
      },
    },
  );
  if (fieldwork.posting)
    fieldwork.posting.salary = {
      minimum: 120000,
      maximum: 155000,
      currency: 'USD',
      period: 'year',
    };
  const commonplace = sampleRole(
    'commonplace-senior',
    'commonplace',
    'Senior Software Engineer',
    {
      stage: 'interviewing',
      interest: 'interested',
      priority: 'medium',
      followUpOn: '2026-09-23',
      notes:
        'Ask how the team balances product discovery with technical investment.',
      submittedMaterial: {
        fileName: 'product-engineering-v3.pdf',
        resumeLabel: 'Product engineering · v3',
        submittedOn: '2026-09-04',
      },
    },
  );
  if (commonplace.posting)
    commonplace.posting.salary = {
      minimum: 160000,
      maximum: 200000,
      currency: 'USD',
      period: 'year',
    };
  const mosaic = sampleRole('mosaic-product', 'mosaic', 'Product Engineer', {
    stage: 'closed',
    interest: 'interested',
    priority: 'low',
    plannedResumeId: 'general-v5',
    notes: 'Withdrew after learning more about the scope of the role.',
    tasks: [
      {
        id: 'mosaic-referral',
        kind: 'referral',
        label: 'Find referral',
        completed: true,
      },
    ],
    submittedMaterial: {
      fileName: 'general-resume-v5.pdf',
      resumeLabel: 'General resume · v5',
      submittedOn: '2026-09-01',
    },
  });
  if (mosaic.posting)
    mosaic.posting.salary = {
      minimum: 145000,
      maximum: 185000,
      currency: 'USD',
      period: 'year',
    };
  return {
    opportunities: [
      sampleRole('northstar-product', 'northstar', 'Senior Product Engineer'),
      juniper,
      fieldwork,
      platform,
      commonplace,
      mosaic,
    ],
    companies: [
      {
        id: 'northstar',
        name: 'Northstar',
        research:
          'A small product team building tools for independent businesses.',
        interviewLoop: 'Recruiter → technical screen → team conversation',
        contacts: [
          { id: 'alex', name: 'Alex', relationship: 'Former teammate' },
        ],
      },
      ...[
        ['juniper', 'Juniper Labs'],
        ['fieldwork', 'Fieldwork'],
        ['commonplace', 'Commonplace'],
        ['mosaic', 'Mosaic Works'],
      ].map(([id, name]) => ({
        id,
        name,
        research: null,
        interviewLoop: null,
        contacts: [],
      })),
    ],
    resumes: [
      { id: 'product-v3', label: 'Product engineering · v3' },
      { id: 'platform-v2', label: 'Platform engineering · v2' },
      { id: 'general-v5', label: 'General resume · v5' },
    ],
  };
}
