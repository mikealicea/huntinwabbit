import { z } from 'zod';
import { companyAssociationSchema } from './job-api.companies.contracts';

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
  // Older saved records predate technology extraction; absence is not an empty result.
  technologies: items.optional(),
  preferredQualifications: items,
  benefits: items,
  compensation: z.array(compensationSchema).max(50),
  postingId: nullableText,
  publishedDate: z.iso.date().nullable(),
  closingDate: z.iso.date().nullable(),
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

export const MAX_RECORD_BYTES = 256 * 1024;
export const applicationSchema = z.strictObject({
  stage: z.enum([
    'collected',
    'applied',
    'preparing',
    'interviewing',
    'offer',
    'closed',
  ]),
  interest: z.enum(['not-set', 'throwaway', 'interested', 'highly-interested']),
  priority: z.enum(['not-set', 'high', 'medium', 'low']),
  followUpOn: z.iso.date().nullable(),
  notes: z.string().max(20_000),
});
export const postingFieldsSchema = jobSchema.omit({ company: true }).extend({
  companyName: jobSchema.shape.company.shape.name,
  companyWebsite: jobSchema.shape.company.shape.website,
});
export const editableFieldsSchema = postingFieldsSchema.extend({
  ...applicationSchema.shape,
  sourceUrl: z.url(),
});
export type EditableFields = z.infer<typeof editableFieldsSchema>;
export type FieldName = keyof EditableFields;
export const fieldNameSchema = z.enum(
  Object.keys(editableFieldsSchema.shape) as [FieldName, ...FieldName[]],
);
export const roleEditsSchema = z.strictObject({
  overrides: postingFieldsSchema.partial(),
  revisions: z.partialRecord(fieldNameSchema, z.number().int().nonnegative()),
  pending: z.string().nullable(),
});
export const saveRequestSchema = z.strictObject({
  url: z.string().trim().min(1).max(8_192),
  extract: z.boolean().default(false),
  parsedPosting: parseResponseSchema.nullable().default(null),
  application: applicationSchema
    .partial()
    .prefault({})
    .transform((value) => ({
      stage: 'collected' as const,
      interest: 'not-set' as const,
      priority: 'not-set' as const,
      followUpOn: null,
      notes: '',
      ...value,
    })),
});
const sourceUrl = z.url();
// Persisted values require every field; input defaults must not repair corrupt data.
export const legacyPostingSchema = z.strictObject({
  id: z.uuid(),
  sourceUrl,
  parsedPosting: parseResponseSchema.nullable(),
  application: applicationSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const extractionSchema = z.strictObject({
  status: z.enum([
    'not-requested',
    'disabled',
    'queued',
    'processing',
    'complete',
    'failed',
  ]),
  generation: z.uuid().nullable(),
  error: z.string().nullable(),
});
export const savedPostingSchema = legacyPostingSchema.extend({
  companyAssociation: companyAssociationSchema.optional(),
  edits: roleEditsSchema.optional(),
  applicationVersion: z.number().int().nonnegative(),
  recordVersion: z.number().int().nonnegative(),
  extraction: extractionSchema,
});
export const updateRequestSchema = z.strictObject({
  expectedApplicationVersion: z.number().int().nonnegative(),
  changes: applicationSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0),
});
export const deleteRequestSchema = z.strictObject({
  expectedApplicationVersion: z.number().int().nonnegative(),
});
export const extractionRequestSchema = z.strictObject({
  expectedGeneration: z.uuid().nullable(),
});
export type UpdateInput = z.infer<typeof updateRequestSchema>;
export const listRequestSchema = z.strictObject({
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-4]\d|50)$/)
    .transform(Number)
    .default(20),
  cursor: z.string().min(1).max(1_024).optional(),
});
export const listResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.array(savedPostingSchema).max(50),
  nextCursor: z.string().nullable(),
});
export const saveResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  item: savedPostingSchema,
  created: z.boolean(),
});

export const itemResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  item: savedPostingSchema,
});
export type SavedPosting = z.infer<typeof savedPostingSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ListResponse = z.infer<typeof listResponseSchema>;

export const updateMessageSchema = z.strictObject({
  operationId: z.uuid(),
  text: z.string().trim().min(1).max(20_000),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  retryOf: z.uuid().optional(),
});
export const changeSchema = z.strictObject({
  field: fieldNameSchema,
  before: z.unknown(),
  after: z.unknown(),
});
export const updateEntrySchema = z.strictObject({
  id: z.uuid(),
  text: z.string(),
  createdAt: z.iso.datetime(),
  status: z.enum([
    'queued',
    'processing',
    'applied',
    'partial',
    'unchanged',
    'failed',
  ]),
  changes: z.array(changeSchema),
  skipped: z.array(z.string()),
  error: z.string().nullable(),
  undoneAt: z.iso.datetime().nullable(),
  retryOf: z.uuid().optional(),
});
export const updateHistorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.array(updateEntrySchema).max(5),
  nextCursor: z.string().nullable(),
});
export const updateResultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entry: updateEntrySchema,
});
export const historyQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(2048).optional(),
});

export type UpdateEntry = z.infer<typeof updateEntrySchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type Job = z.infer<typeof jobSchema>;
