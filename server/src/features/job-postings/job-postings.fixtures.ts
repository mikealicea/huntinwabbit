import { parseResponseSchema } from '../job-parsing/job-parsing.index.ts';

/** Fictional facts only; no live posting or user data. */
export function parsedPostingFixture() {
  return parseResponseSchema.parse({
    schemaVersion: 1,
    source: {
      normalizedUrl: 'https://example.test/job',
      fetchedAt: '2026-09-21T12:00:00.000Z',
    },
    job: {
      company: { name: 'Example Company', website: null },
      title: 'Engineer',
      locations: ['New York', 'Remote'],
      workArrangement: 'hybrid',
      employmentType: null,
      description: 'Build fictional software.',
      responsibilities: ['Build software.'],
      requirements: [],
      preferredQualifications: [],
      benefits: [],
      compensation: [
        {
          minimum: 100_000,
          maximum: 150_000,
          currency: 'USD',
          period: 'year',
          kind: 'base',
          location: 'New York',
          originalText: '$100,000–$150,000 per year in New York',
        },
        {
          minimum: null,
          maximum: 140_000,
          currency: 'USD',
          period: 'year',
          kind: 'base',
          location: 'Remote',
          originalText: 'Up to $140,000 per year remotely',
        },
      ],
      postingId: null,
      publishedDate: null,
      closingDate: null,
    },
    warnings: [],
  });
}
