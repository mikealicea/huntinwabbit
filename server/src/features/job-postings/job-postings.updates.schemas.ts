import { z } from 'zod';
import { companyAssociationSchema } from '../companies/companies.index.ts';
import {
  editableFieldsSchema,
  fieldNameSchema,
  roleEditsSchema,
} from './job-postings.schemas.ts';

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
export const modelUpdatesSchema = z.strictObject({
  changes: z
    .array(z.strictObject({ field: fieldNameSchema, value: z.unknown() }))
    .max(30),
  skipped: z.array(z.string().max(500)).max(30),
});
export const updateJobSchema = z.strictObject({
  pk: z.string(),
  sk: z.string(),
  recordKey: z.string(),
  roleId: z.uuid(),
  status: updateEntrySchema.shape.status,
  data: z.string(),
  dueGroup: z.literal('PENDING').optional(),
  dueAt: z.number().optional(),
});
export const updateDataSchema = z.strictObject({
  beforeCompanyAssociation: companyAssociationSchema.optional(),
  companyBaselineRevision: z.number().int().nonnegative().optional(),
  appliedCompanyRevision: z.number().int().nonnegative().optional(),
  entry: updateEntrySchema,
  timezone: updateMessageSchema.shape.timezone,
  baseline: editableFieldsSchema,
  revisions: roleEditsSchema.shape.revisions,
  beforeOverrides: roleEditsSchema.shape.overrides,
  appliedRevisions: roleEditsSchema.shape.revisions,
});
export type UpdateEntry = z.infer<typeof updateEntrySchema>;
export type UpdateData = z.infer<typeof updateDataSchema>;
export type UpdateJob = z.infer<typeof updateJobSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type ParseUpdates = (
  input: {
    text: string;
    current: z.infer<typeof editableFieldsSchema>;
    history: UpdateEntry[];
    today: string;
  },
  signal: AbortSignal,
) => Promise<z.infer<typeof modelUpdatesSchema>>;
