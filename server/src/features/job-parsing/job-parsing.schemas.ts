import { z } from 'zod';

export const MAX_SOURCE_CHARACTERS = 100_000;
export const MAX_MODEL_BYTES = 256_000;
const text = z.string().trim().min(1).max(4_000);
const nullableText = text.nullable();
const items = z.array(text).max(200);
const publicUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  );
});

export const parseRequestSchema = z.strictObject({
  url: z.string().trim().min(1).max(8_192),
});

export const compensationSchema = z
  .strictObject({
    minimum: z.number().nonnegative().nullable(),
    maximum: z.number().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    period: z
      .enum(['hour', 'day', 'week', 'month', 'year', 'one-time'])
      .nullable(),
    kind: z.enum(['base', 'total', 'bonus', 'equity', 'other']).nullable(),
    location: nullableText,
    originalText: text,
  })
  .refine(
    (value) =>
      value.minimum === null ||
      value.maximum === null ||
      value.minimum <= value.maximum,
  );

export const jobSchema = z.strictObject({
  company: z.strictObject({
    name: nullableText,
    website: publicUrl.nullable(),
  }),
  title: nullableText,
  locations: items,
  workArrangement: z.enum(['remote', 'hybrid', 'on-site']).nullable(),
  employmentType: nullableText,
  description: z.string().trim().min(1).max(60_000).nullable(),
  responsibilities: items,
  requirements: items,
  preferredQualifications: items,
  benefits: items,
  compensation: z.array(compensationSchema).max(50),
  postingId: nullableText,
  publishedDate: z.iso.date().nullable(),
  closingDate: z.iso.date().nullable(),
});

// Classification is internal: a challenge page must not become an empty job.
export const extractionSchema = z.strictObject({
  pageType: z.enum(['job', 'expired', 'blocked', 'not-job']),
  job: jobSchema.nullable(),
});

export const parseResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.strictObject({
    normalizedUrl: publicUrl,
    fetchedAt: z.iso.datetime(),
  }),
  job: jobSchema,
  warnings: z.array(
    z.enum([
      'MISSING_TITLE',
      'MISSING_COMPANY',
      'MISSING_DESCRIPTION',
      'MISSING_COMPENSATION',
    ]),
  ),
});

export type ParsedJob = z.infer<typeof jobSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type ParseResponse = z.infer<typeof parseResponseSchema>;

export interface FetchedPosting {
  content: string;
  fetchedAt: string;
}

export type FetchPosting = (
  url: string,
  signal: AbortSignal,
) => Promise<FetchedPosting>;
export type ExtractPosting = (
  content: string,
  signal: AbortSignal,
) => Promise<Extraction>;
export type ParsePosting = (
  url: string,
  signal: AbortSignal,
) => Promise<ParseResponse>;
