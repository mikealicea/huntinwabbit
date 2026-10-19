import type {
  InterviewProcess,
  Job,
  PrepContext,
  RoleNote,
} from '@/features/job-api/job-api.index';
import { toOpportunity } from '@/features/job-search/job-search.index';

export type PrepFilename =
  | 'job-listing.md'
  | 'company-context.md'
  | 'role-context.md';
export type PrepDocument = {
  filename: PrepFilename;
  downloadFilename: string;
  title: string;
  markdown: string;
};
export type PrepMaterials = {
  documents: readonly PrepDocument[];
  archiveFilename: string;
};

type Stage = InterviewProcess['stages'][number];
type PostingField =
  | Exclude<keyof Job, 'company'>
  | 'companyName'
  | 'companyWebsite';

const postingLabels: Record<PostingField, string> = {
  title: 'Title',
  companyName: 'Source-derived company name',
  companyWebsite: 'Source-derived company website',
  description: 'Full description',
  locations: 'Locations',
  employmentType: 'Employment type',
  workArrangement: 'Work arrangement',
  requirements: 'Requirements',
  preferredQualifications: 'Preferred qualifications',
  technologies: 'Technologies',
  responsibilities: 'Responsibilities',
  benefits: 'Benefits',
  postingId: 'Posting identifier',
  publishedDate: 'Published date',
  closingDate: 'Closing date',
  compensation: 'Compensation bands',
};

// The delimiter must also contain backticks in pasted code, Markdown and emails.
function fenced(text: string, language = ''): string {
  let length = 3;
  for (const run of text.matchAll(/`+/g))
    length = Math.max(length, run[0].length + 1);
  const fence = '`'.repeat(length);
  return `${fence}${language}\n${text}\n${fence}\n\n`;
}

function value(label: string, content: unknown): string {
  const heading = `**${label}**\n\n`;
  if (content === undefined || content === null)
    return `${heading}Unknown / not saved.\n\n`;
  if (typeof content === 'string') return heading + fenced(content);
  return heading + fenced(JSON.stringify(content, null, 2), 'json');
}

function textList(
  label: string,
  contents: readonly string[] | undefined,
): string {
  if (contents === undefined) return value(label, undefined);
  return `**${label}**\n\n${contents.length ? contents.map((text) => fenced(text)).join('') : 'None saved (empty list).\n\n'}`;
}

function postingValue(job: Job | undefined, field: PostingField): unknown {
  if (field === 'companyName') return job?.company.name;
  if (field === 'companyWebsite') return job?.company.website;
  return job?.[field];
}

function postingField(field: PostingField, content: unknown): string {
  const label = postingLabels[field];
  if (field === 'compensation' && Array.isArray(content)) {
    const bands = content as Job['compensation'];
    return `**${label}**\n\n${
      bands.length
        ? bands
            .map(
              (band, index) =>
                `#### Compensation band ${index + 1}\n\n` +
                value('Kind', band.kind) +
                value('Minimum', band.minimum) +
                value('Maximum', band.maximum) +
                value('Currency', band.currency) +
                value('Period', band.period) +
                value('Location', band.location) +
                value('Original text', band.originalText),
            )
            .join('')
        : 'None saved (empty list).\n\n'
    }`;
  }
  if (Array.isArray(content)) return textList(label, content as string[]);
  return value(label, content);
}

function chronological<T extends { createdAt: string; id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const time = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return time || a.id.localeCompare(b.id);
  });
}

function notes(items: readonly RoleNote[]): string {
  if (!items.length) return 'No saved notes.\n\n';
  return chronological(items)
    .map(
      (note, index) =>
        `#### Saved comment ${index + 1}\n\n` +
        value('Comment ID', note.id) +
        value('Created at (UTC)', note.createdAt) +
        value('Edited at (UTC)', note.updatedAt) +
        value('Revision', note.revision) +
        value('Comment text', note.body),
    )
    .join('');
}

function introduction(
  context: PrepContext,
  job: Job | undefined,
  stage: Stage,
  title: string,
  scope: string,
  companions: string,
): string {
  return (
    `# ${title}\n\n${scope}\n\n` +
    value('Role ID', context.posting.id) +
    value('Role title', job?.title) +
    value('Saved associated company', context.company?.details.name) +
    value('Saved associated company ID', context.company?.details.id) +
    value('Selected prep stage', stage.name) +
    value('Selected prep stage ID', stage.id) +
    value('Collection started at (UTC)', context.startedAt) +
    value('Collection completed at (UTC)', context.completedAt) +
    'These are saved reads over an interval, not an atomic snapshot. Unsaved drafts, deleted comments and previous comment revisions are unavailable.\n\n' +
    `Companion documents: ${companions}.\n\n`
  );
}

function listing(context: PrepContext, job: Job | undefined): string {
  const posting = context.posting;
  const overrides = posting.edits?.overrides ?? {};
  const fields = Object.keys(postingLabels) as PostingField[];
  const overridden = fields.filter((field) => Object.hasOwn(overrides, field));
  let result = `## Current job listing\n\n${value('Source URL', posting.sourceUrl)}`;
  result +=
    'Source-derived company facts below are distinct from the saved associated company identified above. Unknown or explicitly cleared values are not restored from extraction.\n\n';
  for (const field of fields)
    result += postingField(field, postingValue(job, field));
  result +=
    '## Listing provenance\n\n' +
    value('Role created at (UTC)', posting.createdAt) +
    value('Role updated at (UTC)', posting.updatedAt) +
    value('Extraction status', posting.extraction.status) +
    value('Extraction generation', posting.extraction.generation) +
    value('Extraction error', posting.extraction.error) +
    value('Parsed source provenance', posting.parsedPosting?.source) +
    value('Parsed source warnings', posting.parsedPosting?.warnings) +
    textList('Fields with saved overrides', overridden);
  result += '## Original pasted listing text\n\n';
  const source = context.source.source;
  if (source) {
    result +=
      value('Retained source URL', source.sourceUrl) +
      value('Retained source revision', source.revision) +
      value('Retained source updated at (UTC)', source.updatedAt);
    if (source.sourceUrl !== posting.sourceUrl)
      result +=
        'Source URL mismatch: retained text belongs to a different URL than the current posting URL.\n\n';
    result += value('Retained page text (verbatim)', source.text);
  } else result += 'No retained page text saved.\n\n';
  result +=
    '## Superseded extracted values\n\nThese are original extracted values replaced by saved overrides, not current facts.\n\n';
  if (!overridden.length)
    result += 'No posting fields have saved overrides.\n\n';
  for (const field of overridden)
    result += postingField(
      field,
      postingValue(posting.parsedPosting?.job, field),
    );
  return result;
}

function company(context: PrepContext): string {
  let result = '## Saved company information\n\n';
  if (!context.company)
    return `${result}No saved company association.\n\n## Your company notes\n\nNo saved company notes are associated with this role.\n\n## Existing AI-generated company analysis\n\nNo associated company analysis was loaded.\n\n`;
  const { details, analysis } = context.company;
  result +=
    value('Company ID', details.id) +
    value('Company name', details.name) +
    value('Website', details.website) +
    value('Created at (UTC)', details.createdAt) +
    value('Updated at (UTC)', details.updatedAt);
  result +=
    '## Your company notes\n\nSaved user-provided company comments.\n\n' +
    notes(context.company.notes);
  result +=
    '## Existing AI-generated company analysis\n\nGenerated analysis is separate from user-provided information. Only existing saved findings and evidence are included; referenced roles and links were not followed.\n\n' +
    value('Status', analysis.status) +
    value('Stale', analysis.stale) +
    value('Completed at (UTC)', analysis.completedAt) +
    value('Scheduled for (UTC)', analysis.scheduledFor) +
    value('Processing generation', analysis.generation) +
    value('Total roles', analysis.totalRoles) +
    value('Analyzed roles', analysis.analyzedRoles) +
    value('Progress', analysis.progress) +
    value('Error', analysis.error);
  if (!analysis.items.length)
    result +=
      'No saved findings in this analysis state. This does not establish that no commonalities exist.\n\n';
  const evidenceLabels = {
    posting: 'Posting evidence',
    correction: 'Saved correction evidence',
    personal: 'Personal context evidence',
    history: 'Historical Update role evidence',
    'company-comment': 'Company comment evidence',
  };
  for (const [index, finding] of analysis.items.entries()) {
    result +=
      `### Saved finding ${index + 1}\n\n` +
      value('Label', finding.label) +
      value('Category', finding.category) +
      value('Qualifier', finding.qualifier) +
      value('Explanation', finding.explanation);
    for (const evidence of finding.evidence) {
      result +=
        `#### ${evidenceLabels[evidence.source]}\n\n` +
        value('Evidence source', evidence.source);
      if (evidence.source === 'company-comment')
        result +=
          value('Company ID', evidence.companyId) +
          value('Comment ID', evidence.noteId);
      else
        result +=
          value('Role ID', evidence.roleId) +
          value('Role title', evidence.roleTitle);
      result += value('Evidence excerpt', evidence.excerpt);
    }
  }
  return result;
}

function stageDetails(
  stage: Stage,
  process: InterviewProcess,
  grouped: Map<string, RoleNote[]>,
): string {
  return (
    value('Stage name', stage.name) +
    value('Stage ID', stage.id) +
    value(
      'Position in saved process',
      process.stages.findIndex((entry) => entry.id === stage.id) + 1,
    ) +
    value('Total saved steps', process.stages.length) +
    value('Current stage', process.currentStageId === stage.id) +
    value('Saved stage context', stage.context) +
    '### Linked saved comments\n\n' +
    notes(grouped.get(stage.id) ?? [])
  );
}

function role(
  context: PrepContext,
  stage: Stage,
  process: InterviewProcess,
): string {
  const grouped = new Map<string, RoleNote[]>();
  const unassigned: RoleNote[] = [];
  const removed: RoleNote[] = [];
  const stageIds = new Set(process.stages.map((entry) => entry.id));
  for (const note of context.roleNotes) {
    if (!note.interviewStageId) unassigned.push(note);
    else if (!stageIds.has(note.interviewStageId)) removed.push(note);
    else {
      const group = grouped.get(note.interviewStageId) ?? [];
      group.push(note);
      grouped.set(note.interviewStageId, group);
    }
  }
  const posting = context.posting;
  let result =
    '## Preparation target\n\nStage position does not establish completed interviews. Saved stage context can come from Update role extraction.\n\n' +
    stageDetails(stage, process, grouped);
  result +=
    '## Application context\n\nPosting facts are in job-listing.md.\n\n' +
    value('Application stage', posting.application.stage) +
    value('Interest', posting.application.interest) +
    value('Priority', posting.application.priority) +
    value('Follow-up date', posting.application.followUpOn) +
    value('Stage entered at (UTC)', posting.stageEnteredAt) +
    value('Pending update', posting.edits?.pending);
  result += '## Other interview steps\n\n';
  const other = process.stages.filter((entry) => entry.id !== stage.id);
  if (!other.length) result += 'No other saved interview steps.\n\n';
  for (const entry of other)
    result += `### Saved interview step\n\n${stageDetails(entry, process, grouped)}`;
  result += `## Other role notes\n\n### Unassigned comments\n\n${notes(unassigned)}`;
  if (removed.length) {
    result += '### Removed interview step comments\n\n';
    for (const note of chronological(removed))
      result +=
        value('Removed interview step', note.interviewStageId) + notes([note]);
  }
  if (posting.application.notes.length)
    result += `### Legacy saved role notes\n\n${fenced(posting.application.notes)}`;
  result +=
    '## Update role history\n\nReceipts are generated interpretations, not independent source facts. Undone, failed and pending receipts are not current facts; later changes can also supersede applied receipts. Original messages remain here regardless of subject matter.\n\n';
  if (!context.updates.length) result += 'No saved Update role history.\n\n';
  for (const entry of chronological(context.updates)) {
    result +=
      '### Saved Update role entry\n\n' +
      value('Entry ID', entry.id) +
      value('Created at (UTC)', entry.createdAt) +
      value('Intent', entry.intent) +
      value('Status', entry.status) +
      value('Retry of', entry.retryOf) +
      value('Undone at (UTC)', entry.undoneAt) +
      value('Original message (verbatim)', entry.text) +
      value(
        'Generated change receipt (structured before/after values)',
        entry.changes,
      ) +
      textList('Skipped messages', entry.skipped) +
      value('Error', entry.error);
  }
  return result;
}

function filenameSegment(
  text: string | null | undefined,
  fallback: string,
): string {
  return (
    text
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || fallback
  );
}

export function formatPrepMaterials(context: PrepContext): PrepMaterials {
  const process = context.posting.application.interviewProcess;
  const stage = process?.stages.find((entry) => entry.id === context.stageId);
  // Acquisition guarantees this target; never silently prepare a different step.
  if (!process || !stage)
    throw new Error('The saved preparation target is unavailable.');
  const job = toOpportunity(context.posting).jobDetails;
  const identity = `${filenameSegment(context.company?.details.name, 'company')}-${filenameSegment(job?.title, 'role')}`;
  const documents: PrepDocument[] = [
    {
      filename: 'job-listing.md',
      downloadFilename: `${identity}-job-listing.md`,
      title: 'Job listing',
      markdown:
        introduction(
          context,
          job,
          stage,
          'Job listing',
          'Current effective listing facts, extraction provenance and original retained page text. No application tracking or comment history.',
          'company-context.md and role-context.md',
        ) + listing(context, job),
    },
    {
      filename: 'company-context.md',
      downloadFilename: `${identity}-company-context.md`,
      title: 'Company context',
      markdown:
        introduction(
          context,
          job,
          stage,
          'Company context',
          'Saved associated company information, user-provided company comments and separately labeled existing generated analysis.',
          'job-listing.md and role-context.md',
        ) + company(context),
    },
    {
      filename: 'role-context.md',
      downloadFilename: `${identity}-role-context.md`,
      title: 'Role and interview context',
      markdown:
        introduction(
          context,
          job,
          stage,
          'Role and interview context',
          'Selected interview target, application tracking, all saved interview steps, role comments and full public Update role history.',
          'job-listing.md and company-context.md',
        ) + role(context, stage, process),
    },
  ];
  return {
    documents,
    archiveFilename: `${identity}-${filenameSegment(stage.name, 'stage')}-prep-${context.completedAt.slice(0, 10)}.zip`,
  };
}
