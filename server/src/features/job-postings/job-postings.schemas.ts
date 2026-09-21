import { z } from 'zod';
import { parseResponseSchema } from '../job-parsing/job-parsing.index.ts';

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
  applicationVersion: z.number().int().nonnegative(),
  recordVersion: z.number().int().nonnegative(),
  extraction: extractionSchema,
});
export const storedPostingSchema = z.union([
  savedPostingSchema,
  legacyPostingSchema.transform((item) => ({
    ...item,
    applicationVersion: 0,
    recordVersion: 0,
    extraction: {
      status: item.parsedPosting
        ? ('complete' as const)
        : ('not-requested' as const),
      generation: null,
      error: null,
    },
  })),
]);
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
export interface PostingOperations {
  delete(
    userId: string,
    id: string,
    expectedApplicationVersion: number,
    signal: AbortSignal,
  ): Promise<void>;
  get(userId: string, id: string, signal: AbortSignal): Promise<SavedPosting>;
  update(
    userId: string,
    id: string,
    input: UpdateInput,
    signal: AbortSignal,
  ): Promise<SavedPosting>;
  extract(
    userId: string,
    id: string,
    generation: string | null,
    signal: AbortSignal,
  ): Promise<SavedPosting>;
}
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
export type SavedPosting = z.infer<typeof savedPostingSchema>;
export type SaveInput = z.infer<typeof saveRequestSchema>;
export type ListInput = z.infer<typeof listRequestSchema>;
export interface PostingStore extends PostingOperations {
  save(
    userId: string,
    item: SavedPosting,
    signal: AbortSignal,
  ): Promise<{ item: SavedPosting; created: boolean }>;
  list(
    userId: string,
    input: ListInput,
    signal: AbortSignal,
  ): Promise<z.infer<typeof listResponseSchema>>;
}
export interface JobPostings extends PostingOperations {
  save(
    userId: string,
    input: SaveInput,
    signal: AbortSignal,
  ): Promise<z.infer<typeof saveResponseSchema>>;
  list(
    userId: string,
    input: ListInput,
    signal: AbortSignal,
  ): Promise<z.infer<typeof listResponseSchema>>;
}
