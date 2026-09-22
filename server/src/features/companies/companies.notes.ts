import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import {
  createNotesStore,
  type NotesTransport,
  readNoteRow,
} from '../../shared/shared.notes.ts';
import { analysisInvalidation } from '../company-analysis/company-analysis.index.ts';
import { companySchema } from './companies.schemas.ts';
export function companyNoteError(code: string, cause?: unknown) {
  return new AppError(
    code === 'NOT_FOUND'
      ? 404
      : code === 'CONFLICT'
        ? 409
        : ['INVALID_REQUEST', 'INVALID_CURSOR'].includes(code)
          ? 400
          : 503,
    'The company comment request could not be completed.',
    { code, cause },
  );
}
export function createCompanyNotes(
  table: string,
  send: NotesTransport,
  now = Date.now,
) {
  return createNotesStore({
    table,
    send,
    now,
    prefix: 'COMPANY-NOTE',
    error: companyNoteError,
    async lookup(user, id, signal) {
      const pk = `USER#${user}`,
        recordKey = `COMPANY#${id}`;
      const row = await readNoteRow(table, send, pk, recordKey, signal);
      if (!row) throw companyNoteError('NOT_FOUND');
      const company = companySchema.parse(row.company);
      if (row.pk !== pk || row.sk !== recordKey || company.id !== id)
        throw companyNoteError('STORAGE_UNAVAILABLE');
      const revision = z
        .number()
        .int()
        .nonnegative()
        .parse(row.notesRevision ?? 0);
      return { pk, recordKey, previous: String(revision), company, revision };
    },
    parentWrites: (found, _timestamp, deleting) => [
      {
        Update: {
          TableName: table,
          Key: { pk: found.pk, sk: found.recordKey },
          UpdateExpression: 'SET notesRevision = :next',
          ConditionExpression:
            'attribute_exists(pk) AND (notesRevision = :previous OR attribute_not_exists(notesRevision))',
          ExpressionAttributeValues: {
            ':next': found.revision + 1,
            ':previous': found.revision,
          },
        },
      },
      analysisInvalidation(table, found.pk, found.company.id, deleting, now()),
    ],
    async bounded(work) {
      const signal = AbortSignal.timeout(10_000);
      let abort = () => {};
      try {
        return await Promise.race([
          work(signal),
          new Promise<never>((_resolve, reject) => {
            abort = () => reject(companyNoteError('STORAGE_UNAVAILABLE'));
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
          }),
        ]);
      } catch (cause) {
        if (cause instanceof AppError) throw cause;
        throw companyNoteError('STORAGE_UNAVAILABLE', cause);
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  });
}
export type CompanyNotes = ReturnType<typeof createCompanyNotes>;
