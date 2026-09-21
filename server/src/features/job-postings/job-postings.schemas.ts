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
export const savedPostingSchema = z.strictObject({
  id: z.uuid(),
  sourceUrl,
  parsedPosting: parseResponseSchema.nullable(),
  application: applicationSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
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
export interface PostingStore {
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
export interface JobPostings {
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
