import { z } from 'zod';
export const analysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
  intent: z.enum(['ensure', 'refresh']),
});
export const analysisQuerySchema = z.strictObject({
  cursor: z.string().max(2048).optional(),
});
const evidence = z.strictObject({
  roleId: z.uuid(),
  roleTitle: z.string().max(4000),
  source: z.enum(['posting', 'correction', 'personal', 'history']),
  excerpt: z.string().min(1).max(600),
});
export const analysisResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.enum([
    'disabled',
    'not-started',
    'scheduled',
    'processing',
    'complete',
    'failed',
  ]),
  generation: z.uuid().nullable(),
  stale: z.boolean(),
  totalRoles: z.number().int().nonnegative(),
  analyzedRoles: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  progress: z.number().int().nonnegative(),
  error: z.string().nullable(),
  items: z
    .array(
      z.strictObject({
        category: z.enum(['requirement', 'technology']),
        label: z.string().min(1).max(200),
        qualifier: z.enum([
          'required',
          'preferred',
          'used',
          'observed',
          'unspecified',
        ]),
        explanation: z.string().max(600),
        evidence: z.array(evidence).min(1).max(200),
      }),
    )
    .max(20),
  nextCursor: z.string().nullable(),
});
export type CompanyAnalysis = z.infer<typeof analysisResponseSchema>;
