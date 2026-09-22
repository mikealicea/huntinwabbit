import { createNotesStore } from '../../shared/shared.notes.ts';
import {
  type DynamoTransport,
  readRecord,
  recordKey,
  storageOperation,
} from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import { postingPut, readRow } from './job-postings.operations.ts';
export function createRoleNotes(
  table: string,
  send: DynamoTransport,
  now = Date.now,
) {
  async function lookup(user: string, id: string, signal: AbortSignal) {
    const pk = `USER#${user}`;
    const pointer = await readRow(table, send, pk, `ID#${id}`, signal);
    if (!pointer) throw postingError('NOT_FOUND');
    if (
      pointer.pk !== pk ||
      pointer.sk !== `ID#${id}` ||
      typeof pointer.recordKey !== 'string'
    )
      throw postingError('INVALID_STORED_POSTING');
    const row = await readRow(table, send, pk, pointer.recordKey, signal);
    if (!row) throw postingError('NOT_FOUND');
    const item = readRecord(row, pk, pointer.recordKey);
    if (item.id !== id || typeof row.data !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    return { pk, item, previous: row.data, recordKey: recordKey(item) };
  }
  return createNotesStore({
    table,
    send,
    now,
    lookup,
    prefix: 'NOTE',
    error: postingError,
    parentWrites: (found, timestamp) => [
      postingPut(
        table,
        found.pk,
        {
          ...found.item,
          applicationVersion: found.item.applicationVersion + 1,
          recordVersion: found.item.recordVersion + 1,
          updatedAt: timestamp,
        },
        found.previous,
      ),
    ],
    bounded: (work) => {
      const signal = AbortSignal.timeout(10_000);
      return storageOperation(signal, () => work(signal));
    },
  });
}
export type RoleNotes = ReturnType<typeof createRoleNotes>;
