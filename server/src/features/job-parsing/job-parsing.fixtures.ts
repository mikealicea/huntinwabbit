import type { ParsedJob } from './job-parsing.schemas.ts';

/** Fictional posting facts; no captured pages or personal application data. */
export function exampleJob(): ParsedJob {
  return {
    company: { name: 'Example Research', website: null },
    title: 'Software Engineer',
    locations: ['New York', 'Remote within the US'],
    workArrangement: 'hybrid',
    employmentType: 'Full-time',
    description: 'Build reliable software for a fictional research team.',
    responsibilities: ['Build services.'],
    requirements: ['Experience developing software.'],
    preferredQualifications: [],
    benefits: [],
    compensation: [],
    postingId: null,
    publishedDate: null,
    closingDate: null,
  };
}
