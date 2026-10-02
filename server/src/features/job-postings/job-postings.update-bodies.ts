import { z } from 'zod';
import type { DynamoTransport } from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import { readRow } from './job-postings.operations.ts';
import {
  type UpdateData,
  updateTextSchema,
} from './job-postings.updates.schemas.ts';

export const updateBodyKey = (roleId: string, operationId: string) =>
  `JOB#UPDATE-BODY#${roleId}#${operationId}`;

export async function hydrateUpdateBody(
  table: string,
  send: DynamoTransport,
  pk: string,
  recordKey: string,
  roleId: string,
  data: UpdateData,
  signal: AbortSignal,
): Promise<UpdateData> {
  if (!data.bodyStored) return data;
  const sk = updateBodyKey(roleId, data.entry.id);
  const row = z
    .object({
      pk: z.string(),
      sk: z.string(),
      recordKey: z.string(),
      text: updateTextSchema,
    })
    .safeParse(await readRow(table, send, pk, sk, signal));
  if (
    !row.success ||
    row.data.pk !== pk ||
    row.data.sk !== sk ||
    row.data.recordKey !== recordKey
  )
    throw postingError('INVALID_STORED_POSTING');
  return { ...data, entry: { ...data.entry, text: row.data.text } };
}
