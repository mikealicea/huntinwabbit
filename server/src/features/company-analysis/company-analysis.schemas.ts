import { z } from 'zod';

export const analysisRequestSchema = z.strictObject({
  operationId: z.uuid(),
  intent: z.enum(['ensure', 'refresh']),
});
export const analysisQuerySchema = z.strictObject({
  cursor: z.string().max(2048).optional(),
});
export const evidenceSchema = z.union([
  z.strictObject({
    roleId: z.uuid(),
    roleTitle: z.string().max(4000),
    source: z.enum(['posting', 'correction', 'personal', 'history']),
    excerpt: z.string().min(1).max(600),
  }),
  z.strictObject({
    source: z.literal('company-comment'),
    companyId: z.uuid(),
    noteId: z.uuid(),
    excerpt: z.string().min(1).max(600),
  }),
]);
export const findingSchema = z.strictObject({
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
  evidence: z.array(evidenceSchema).min(1).max(200),
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
  scheduledFor: z.iso.datetime().nullable().optional(),
  generation: z.uuid().nullable(),
  stale: z.boolean(),
  totalRoles: z.number().int().nonnegative(),
  analyzedRoles: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  progress: z.number().int().nonnegative(),
  error: z.string().nullable(),
  items: z.array(findingSchema).max(20),
  nextCursor: z.string().nullable(),
});
export type Finding = z.infer<typeof findingSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type RoleSource = {
  roleId: string;
  roleTitle: string;
  source: 'posting' | 'correction' | 'personal' | 'history';
  text: string;
};
export type Source =
  | RoleSource
  | {
      source: 'company-comment';
      companyId: string;
      noteId: string;
      text: string;
    };
export interface InputPage {
  sources: Source[];
  cursor: string | null;
  roles: number;
  usable: number;
}
export type ReadInputs = (
  pk: string,
  company: string,
  cursor: string | null,
  signal: AbortSignal,
) => Promise<InputPage>;
export type Analyze = (
  input: { sources: Source[] } | { findings: Finding[] },
  signal: AbortSignal,
) => Promise<Finding[]>;
export const sourceSchema = z.union([
  z.object({
    roleId: z.uuid(),
    roleTitle: z.string().max(4000),
    source: z.enum(['posting', 'correction', 'personal', 'history']),
    text: z.string().max(24000),
  }),
  z.object({
    source: z.literal('company-comment'),
    companyId: z.uuid(),
    noteId: z.uuid(),
    text: z.string().max(24000),
  }),
]);
export const sourceRevisionSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  revision: z.number().int().nonnegative(),
  hidden: z.boolean().default(false),
  dueAt: z.number().optional(),
});
export const stateSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  companyId: z.uuid(),
  generation: z.uuid(),
  revision: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  status: z.enum(['processing', 'complete', 'failed']),
  companyComments: z.number().int().nonnegative().default(0),
  phase: z.enum(['snapshot', 'map', 'reduce', 'publish']),
  cursor: z.string().nullable(),
  count: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  outputCount: z.number().int().nonnegative(),
  totalRoles: z.number().int().nonnegative(),
  analyzedRoles: z.number().int().nonnegative(),
  progress: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
  resultGeneration: z.uuid().nullable(),
  resultCount: z.number().int().nonnegative(),
  resultRoles: z.number().int().nonnegative(),
  resultTotal: z.number().int().nonnegative(),
  resultCompletedAt: z.iso.datetime().nullable(),
});
export type State = z.infer<typeof stateSchema>;
