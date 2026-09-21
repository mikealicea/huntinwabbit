import type { Job, SavedPosting } from '@/features/job-api/job-api.index';
import type { Opportunity } from './job-search.types';
export function toOpportunity(item: SavedPosting): Opportunity {
  const extracted = item.parsedPosting?.job;
  const overrides = item.edits?.overrides;
  const empty: Job = {
    company: { name: null, website: null },
    title: null,
    locations: [],
    workArrangement: null,
    employmentType: null,
    description: null,
    responsibilities: [],
    requirements: [],
    preferredQualifications: [],
    benefits: [],
    compensation: [],
    postingId: null,
    publishedDate: null,
    closingDate: null,
  };
  const base = extracted ?? empty;
  const job =
    extracted || (overrides && Object.keys(overrides).length)
      ? {
          ...base,
          ...overrides,
          company: {
            name:
              overrides?.companyName === undefined
                ? base.company.name
                : overrides.companyName,
            website:
              overrides?.companyWebsite === undefined
                ? base.company.website
                : overrides.companyWebsite,
          },
        }
      : undefined;
  const salary =
    job?.compensation.find((band) => band.kind === 'base') ??
    job?.compensation[0];
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    companyId: null,
    companyName: job?.company.name ?? null,
    ...item.application,
    saved: item,
    jobDetails: job,
    plannedResumeId: null,
    submittedMaterial: null,
    tasks: [],
    posting: job
      ? {
          title: job.title,
          location: job.locations.join(' · ') || null,
          employmentType: job.employmentType,
          description: job.description,
          requirements: job.requirements,
          salary: salary
            ? {
                minimum: salary.minimum,
                maximum: salary.maximum,
                currency: salary.currency ?? 'Currency not listed',
                period: salary.period ?? 'period not listed',
              }
            : null,
        }
      : null,
  };
}

// Preserve first-seen newest-save ordering while refusing older duplicate record versions.
export function mergePostingPages(
  pages: { items: SavedPosting[] }[],
): SavedPosting[] {
  const records = new Map<string, SavedPosting>();
  for (const page of pages)
    for (const item of page.items) {
      const previous = records.get(item.id);
      if (!previous || item.recordVersion > previous.recordVersion)
        records.set(item.id, item);
    }
  return [...records.values()];
}
