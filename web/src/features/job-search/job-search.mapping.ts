import type { SavedPosting } from '@/features/job-api/job-api.index';
import type { Opportunity } from './job-search.types';
export function toOpportunity(item: SavedPosting): Opportunity {
  const job = item.parsedPosting?.job;
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
