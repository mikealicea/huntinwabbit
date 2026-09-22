import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  type CompanySelection,
  type CompanyStore,
  companyMembershipWrites,
  companySummary,
} from '../companies/companies.index.ts';
import {
  type DynamoTransport,
  readRecord,
  storageOperation,
} from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import { postingPut, readRow } from './job-postings.operations.ts';
import type { SavedPosting } from './job-postings.schemas.ts';
import { effectiveFields } from './job-postings.updates.logic.ts';
export function createPostingCompanies(
  table: string,
  send: DynamoTransport,
  companies: CompanyStore,
) {
  async function lookup(pk: string, id: string, signal: AbortSignal) {
    const pointer = await readRow(table, send, pk, `ID#${id}`, signal);
    if (!pointer || typeof pointer.recordKey !== 'string')
      throw postingError('NOT_FOUND');
    const row = await readRow(table, send, pk, pointer.recordKey, signal);
    if (!row || typeof row.data !== 'string') throw postingError('NOT_FOUND');
    const item = readRecord(row, pk, pointer.recordKey);
    if (item.id !== id) throw postingError('INVALID_STORED_POSTING');
    return { item, previous: row.data };
  }
  return {
    async roles(
      user: string,
      id: string,
      input: { cursor?: string; limit: number },
      signal: AbortSignal,
    ) {
      return storageOperation(signal, async () => {
        const pk = `USER#${user}`;
        const page = await companies.roles(pk, id, input, signal);
        const items: SavedPosting[] = [];
        for (const member of page.items) {
          const row = await readRow(table, send, pk, member.recordKey, signal);
          if (!row) continue; // A membership page can race a committed deletion or move.
          const item = readRecord(row, pk, member.recordKey);
          if (item.id !== member.roleId)
            throw postingError('INVALID_STORED_POSTING');
          if (item.companyAssociation?.company?.id === id) items.push(item);
        }
        return {
          schemaVersion: 1 as const,
          items,
          nextCursor: page.nextCursor,
        };
      });
    },
    async select(
      user: string,
      id: string,
      input: CompanySelection,
      signal: AbortSignal,
    ) {
      return storageOperation(signal, async () => {
        const pk = `USER#${user}`;
        const found = await lookup(pk, id, signal);
        if (found.item.recordVersion !== input.expectedRecordVersion)
          throw postingError('CONFLICT');
        const company =
          input.selection === null
            ? null
            : 'id' in input.selection
              ? await companies.get(pk, input.selection.id, signal)
              : await companies.resolve(
                  pk,
                  input.selection.create.name,
                  input.selection.create.website,
                  signal,
                );
        const next: SavedPosting = {
          ...found.item,
          companyAssociation: {
            company: companySummary(company),
            mode: 'manual',
            revision: (found.item.companyAssociation?.revision ?? 0) + 1,
          },
          recordVersion: found.item.recordVersion + 1,
          applicationVersion: found.item.applicationVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        try {
          await send(
            new TransactWriteCommand({
              TransactItems: [
                postingPut(table, pk, next, found.previous),
                ...companyMembershipWrites(
                  table,
                  pk,
                  next,
                  found.item.companyAssociation,
                  next.companyAssociation,
                ),
              ],
            }),
            signal,
          );
          return next;
        } catch (cause) {
          const current = await lookup(pk, id, signal);
          if (
            current.item.recordVersion === next.recordVersion &&
            JSON.stringify(current.item.companyAssociation) ===
              JSON.stringify(next.companyAssociation)
          )
            return current.item;
          if (current.previous !== found.previous)
            throw postingError('CONFLICT');
          throw cause;
        }
      });
    },
    async backfill(
      user: string,
      id: string,
      signal: AbortSignal,
      dryRun = false,
    ) {
      const pk = `USER#${user}`;
      const found = await lookup(pk, id, signal);
      if (found.item.companyAssociation) return false;
      const fields = effectiveFields(found.item);
      if (!fields.companyName?.trim()) return false;
      if (dryRun) return true;
      const company = await companies.resolve(
        pk,
        fields.companyName,
        fields.companyWebsite,
        signal,
      );
      const next: SavedPosting = {
        ...found.item,
        companyAssociation: {
          company: companySummary(company),
          mode: 'automatic',
          revision: 0,
        },
        recordVersion: found.item.recordVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      try {
        await send(
          new TransactWriteCommand({
            TransactItems: [
              postingPut(table, pk, next, found.previous),
              ...companyMembershipWrites(
                table,
                pk,
                next,
                undefined,
                next.companyAssociation,
              ),
            ],
          }),
          signal,
        );
        return true;
      } catch (cause) {
        const current = await lookup(pk, id, signal);
        if (current.item.companyAssociation) return false;
        if (current.previous !== found.previous) throw postingError('CONFLICT');
        throw cause;
      }
    },
  };
}
export type PostingCompanies = ReturnType<typeof createPostingCompanies>;
