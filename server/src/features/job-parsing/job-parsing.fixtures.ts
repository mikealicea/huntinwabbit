import type { Extraction } from './job-parsing.schemas.ts';

/** Fictional posting facts; no captured pages or personal application data. */
export function exampleJob(): NonNullable<Extraction['job']> {
  return {
    company: { name: 'Example Research', website: null },
    title: 'Software Engineer',
    locations: ['New York', 'Remote within the US'],
    workArrangement: 'hybrid',
    employmentType: 'Full-time',
    description: 'Build reliable software for a fictional research team.',
    responsibilities: ['Build services.'],
    requirements: ['Experience developing software.'],
    technologies: [],
    preferredQualifications: [],
    benefits: [],
    compensation: [],
    postingId: null,
    publishedDate: null,
    closingDate: null,
  };
}
