import { createHash } from 'node:crypto';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { conflict } from '../../shared/shared.errors.ts';
import {
  type CompanyStore,
  companyMembershipWrites,
  companySummary,
} from '../companies/companies.index.ts';
import { normalizeJobUrl } from '../job-parsing/job-parsing.index.ts';
import {
  type DynamoTransport,
  readRecord,
  recordKey,
  storageOperation,
} from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import { postingPut, readRow } from './job-postings.operations.ts';
import {
  applicationSchema,
  editableFieldsSchema,
  type FieldName,
  MAX_RECORD_BYTES,
  type SavedPosting,
} from './job-postings.schemas.ts';
import {
  effectiveFields,
  effectiveUpdateFields,
  same,
  writeField,
} from './job-postings.updates.logic.ts';
import {
  historyQuerySchema,
  modelUpdatesSchema,
  type ParseUpdates,
  type UpdateData,
  type UpdateEntry,
  type UpdateJob,
  type UpdateMessage,
  updateDataSchema,
  updateJobSchema,
  updateMessageSchema,
} from './job-postings.updates.schemas.ts';

type Writes = NonNullable<TransactWriteCommandInput['TransactItems']>;
const signal = () => AbortSignal.timeout(10_000);
const pointerKey = (id: string, operation: string) =>
  `JOB#UPDATE-ID#${id}#${operation}`;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function boundedData(value: UpdateData) {
  const data = JSON.stringify(updateDataSchema.parse(value));
  if (Buffer.byteLength(data) > MAX_RECORD_BYTES)
    throw postingError('POSTING_TOO_LARGE');
  return data;
}
function readJob(value: unknown, pk: string, sk: string) {
  const job = updateJobSchema.parse(value);
  const data = updateDataSchema.parse(JSON.parse(job.data));
  if (
    job.pk !== pk ||
    job.sk !== sk ||
    job.status !== data.entry.status ||
    sk !==
      `JOB#UPDATE#${job.roleId}#${data.entry.createdAt}#${data.entry.id}` ||
    !job.recordKey.endsWith(`#${job.roleId}`)
  )
    throw postingError('INVALID_STORED_POSTING');
  return { job, data };
}
export function createRoleUpdates(
  table: string,
  send: DynamoTransport,
  enabled: boolean,
  parse?: ParseUpdates,
  now = Date.now,
  companies?: CompanyStore,
) {
  async function lookup(user: string, id: string) {
    const pk = `USER#${user}`;
    const pointer = await readRow(table, send, pk, `ID#${id}`, signal());
    if (!pointer) throw postingError('NOT_FOUND');
    if (typeof pointer.recordKey !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    const row = await readRow(table, send, pk, pointer.recordKey, signal());
    if (!row) throw postingError('NOT_FOUND');
    const item = readRecord(row, pk, pointer.recordKey);
    if (item.id !== id || typeof row.data !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    return { pk, item, previous: row.data };
  }
  async function getOperation(pk: string, id: string, operation: string) {
    const pointer = await readRow(
      table,
      send,
      pk,
      pointerKey(id, operation),
      signal(),
    );
    if (!pointer) return undefined;
    if (typeof pointer.jobKey !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    const value = await readRow(table, send, pk, pointer.jobKey, signal());
    if (!value) throw postingError('INVALID_STORED_POSTING');
    const result = readJob(value, pk, pointer.jobKey);
    if (result.job.roleId !== id || result.data.entry.id !== operation)
      throw postingError('INVALID_STORED_POSTING');
    return result;
  }
  function putJob(
    job: UpdateJob,
    data: UpdateData,
    previous?: string,
  ): Writes[number] {
    const pending = ['queued', 'processing'].includes(data.entry.status);
    return {
      Put: {
        TableName: table,
        Item: {
          pk: job.pk,
          sk: job.sk,
          recordKey: job.recordKey,
          roleId: job.roleId,
          status: data.entry.status,
          data: boundedData(data),
          ...(pending
            ? {
                dueGroup: 'PENDING',
                dueAt:
                  now() + (data.entry.status === 'queued' ? 900_000 : 180_000),
              }
            : {}),
        },
        ConditionExpression:
          previous === undefined
            ? 'attribute_not_exists(pk)'
            : '#data = :previous',
        ...(previous === undefined
          ? {}
          : {
              ExpressionAttributeNames: { '#data': 'data' },
              ExpressionAttributeValues: { ':previous': previous },
            }),
      },
    };
  }
  async function urlWrites(
    pk: string,
    old: SavedPosting,
    next: SavedPosting,
  ): Promise<Writes> {
    if (old.sourceUrl === next.sourceUrl) return [];
    const newKey = `URL#${hash(next.sourceUrl)}`;
    if (await readRow(table, send, pk, newKey, signal()))
      throw conflict('That posting URL is already saved.');
    return [
      ...(old.extraction.generation
        ? [
            {
              Delete: {
                TableName: table,
                Key: { pk, sk: `JOB#${old.extraction.generation}` },
                ConditionExpression:
                  'attribute_not_exists(pk) OR recordKey = :key',
                ExpressionAttributeValues: { ':key': recordKey(old) },
              },
            },
          ]
        : []),
      {
        Delete: {
          TableName: table,
          Key: { pk, sk: `URL#${hash(old.sourceUrl)}` },
          ConditionExpression: 'recordKey = :key',
          ExpressionAttributeValues: { ':key': recordKey(old) },
        },
      },
      {
        Put: {
          TableName: table,
          Item: { pk, sk: newKey, recordKey: recordKey(old) },
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
    ];
  }
  async function history(user: string, id: string, query: { cursor?: string }) {
    const { pk } = await lookup(user, id);
    historyQuerySchema.parse(query);
    const prefix = `JOB#UPDATE#${id}#`;
    let after: { pk: string; sk: string } | undefined;
    if (query.cursor) {
      try {
        const cursor = z
          .strictObject({ owner: z.string(), after: z.string() })
          .parse(
            JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
          );
        if (cursor.owner !== hash(pk) || !cursor.after.startsWith(prefix))
          throw new Error();
        after = { pk, sk: cursor.after };
      } catch {
        throw postingError('INVALID_CURSOR');
      }
    }
    const page = z
      .object({
        Items: z.array(z.unknown()).default([]),
        LastEvaluatedKey: z
          .object({ pk: z.string(), sk: z.string() })
          .optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            ConsistentRead: true,
            KeyConditionExpression: 'pk = :owner AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':owner': pk, ':prefix': prefix },
            ScanIndexForward: false,
            Limit: 5,
            ExclusiveStartKey: after,
          }),
          signal(),
        ),
      );
    const items = page.Items.map((value) => {
      const key = z.object({ sk: z.string() }).parse(value).sk;
      if (!key.startsWith(prefix)) throw postingError('INVALID_STORED_POSTING');
      return readJob(value, pk, key).data.entry;
    });
    const last = page.LastEvaluatedKey;
    if (last && (last.pk !== pk || !last.sk.startsWith(prefix)))
      throw postingError('INVALID_CURSOR');
    return {
      schemaVersion: 1 as const,
      items,
      nextCursor: last
        ? Buffer.from(
            JSON.stringify({ owner: hash(pk), after: last.sk }),
          ).toString('base64url')
        : null,
    };
  }
  async function submit(user: string, id: string, raw: UpdateMessage) {
    const input = updateMessageSchema.parse(raw);
    const found = await lookup(user, id);
    const previous = await getOperation(found.pk, id, input.operationId);
    if (previous) {
      if (
        previous.data.entry.text !== input.text ||
        previous.data.timezone !== input.timezone ||
        previous.data.entry.retryOf !== input.retryOf
      )
        throw postingError('CONFLICT');
      return previous.data.entry;
    }
    if (!enabled) throw postingError('PARSING_DISABLED');
    if (found.item.edits?.pending) throw postingError('CONFLICT');
    if (input.retryOf) {
      const original = await getOperation(found.pk, id, input.retryOf);
      if (
        original?.data.entry.status !== 'failed' ||
        original.data.entry.text !== input.text
      )
        throw postingError('INVALID_REQUEST');
    }
    const entry: UpdateEntry = {
      id: input.operationId,
      text: input.text,
      createdAt: new Date(now()).toISOString(),
      status: 'queued',
      changes: [],
      skipped: [],
      error: null,
      undoneAt: null,
      ...(input.retryOf ? { retryOf: input.retryOf } : {}),
    };
    const sk = `JOB#UPDATE#${id}#${entry.createdAt}#${entry.id}`;
    const data: UpdateData = {
      entry,
      timezone: input.timezone,
      baseline: effectiveUpdateFields(found.item),
      beforeCompanyAssociation: found.item.companyAssociation,
      companyBaselineRevision: found.item.companyAssociation?.revision ?? 0,
      revisions: found.item.edits?.revisions ?? {},
      beforeOverrides: found.item.edits?.overrides ?? {},
      appliedRevisions: {},
    };
    const next: SavedPosting = {
      ...found.item,
      edits: {
        overrides: data.beforeOverrides,
        revisions: data.revisions,
        pending: sk,
      },
      recordVersion: found.item.recordVersion + 1,
    };
    const job: UpdateJob = {
      pk: found.pk,
      sk,
      recordKey: recordKey(next),
      roleId: id,
      status: 'queued',
      data: boundedData(data),
    };
    try {
      await send(
        new TransactWriteCommand({
          TransactItems: [
            postingPut(table, found.pk, next, found.previous),
            putJob(job, data),
            {
              Put: {
                TableName: table,
                Item: {
                  pk: found.pk,
                  sk: pointerKey(id, entry.id),
                  recordKey: recordKey(next),
                  jobKey: sk,
                },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
          ],
        }),
        signal(),
      );
      return entry;
    } catch (cause) {
      const recovered = await getOperation(found.pk, id, input.operationId);
      if (recovered) {
        if (
          recovered.data.entry.text !== input.text ||
          recovered.data.timezone !== input.timezone ||
          recovered.data.entry.retryOf !== input.retryOf
        )
          throw postingError('CONFLICT');
        return recovered.data.entry;
      }
      const current = await lookup(user, id);
      if (current.previous !== found.previous) throw postingError('CONFLICT');
      throw cause;
    }
  }
  async function finish(
    job: UpdateJob,
    data: UpdateData,
    output?: z.infer<typeof modelUpdatesSchema>,
    error?: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readRow(table, send, job.pk, job.sk, signal());
      if (!current || current.data !== job.data) return;
      const row = await readRow(table, send, job.pk, job.recordKey, signal());
      if (!row || typeof row.data !== 'string') return;
      const item = readRecord(row, job.pk, job.recordKey);
      if (item.edits?.pending !== job.sk) return;
      const next = structuredClone(item);
      const result = structuredClone(data);
      result.entry.skipped = output?.skipped ?? [];
      const fields = effectiveUpdateFields(item);
      const changes = output?.changes ?? [];
      const counts = new Map<FieldName, number>();
      for (const change of changes)
        counts.set(change.field, (counts.get(change.field) ?? 0) + 1);
      for (const change of changes) {
        const field = change.field;
        let value = change.value;
        if (
          (field === 'companyName' || field === 'companyWebsite') &&
          (item.companyAssociation?.revision ?? 0) !==
            (data.companyBaselineRevision ?? 0)
        ) {
          result.entry.skipped.push(
            `${field}: company selection changed since this message was submitted.`,
          );
          continue;
        }
        if ((counts.get(field) ?? 0) > 1) {
          result.entry.skipped.push(`${field}: conflicting instructions.`);
          continue;
        }
        if (
          !same(fields[field], data.baseline[field]) ||
          (item.edits?.revisions[field] ?? 0) !== (data.revisions[field] ?? 0)
        ) {
          result.entry.skipped.push(
            `${field}: changed since this message was submitted.`,
          );
          continue;
        }
        try {
          if (field === 'sourceUrl')
            value = normalizeJobUrl(z.string().parse(value));
          value = editableFieldsSchema.shape[field].parse(value);
          if (same(value, fields[field])) continue;
          if (
            field === 'sourceUrl' &&
            (await readRow(
              table,
              send,
              job.pk,
              `URL#${hash(String(value))}`,
              signal(),
            ))
          ) {
            result.entry.skipped.push(
              'sourceUrl: that posting URL is already saved.',
            );
            continue;
          }
          writeField(next, field, value);
          result.entry.changes.push({
            field,
            before: fields[field],
            after: value,
          });
          result.appliedRevisions[field] = next.edits?.revisions[field] ?? 0;
        } catch (cause) {
          if (!(cause instanceof z.ZodError) && field !== 'sourceUrl')
            throw cause;
          result.entry.skipped.push(
            `${field}: could not interpret a valid value.`,
          );
        }
      }
      const companyNameChanged = result.entry.changes.some(
        (change) => change.field === 'companyName',
      );
      const companyWebsiteChanged = result.entry.changes.some(
        (change) => change.field === 'companyWebsite',
      );
      if (
        companies &&
        (companyNameChanged ||
          (companyWebsiteChanged && item.companyAssociation?.mode !== 'manual'))
      ) {
        const values = effectiveFields(next);
        const company = await companies.resolve(
          job.pk,
          values.companyName,
          companyNameChanged && !companyWebsiteChanged
            ? null
            : values.companyWebsite,
          signal(),
        );
        next.companyAssociation = {
          company: companySummary(company),
          mode: companyNameChanged ? 'manual' : 'automatic',
          revision: (item.companyAssociation?.revision ?? 0) + 1,
        };
        result.beforeCompanyAssociation = item.companyAssociation;
        result.appliedCompanyRevision = next.companyAssociation.revision;
      }
      if (!next.edits) throw new Error('Missing edits');
      next.edits.pending = null;
      next.recordVersion++;
      if (
        result.entry.changes.some(
          (change) => change.field in applicationSchema.shape,
        )
      )
        next.applicationVersion++;
      next.updatedAt = new Date(now()).toISOString();
      result.entry.status = error
        ? 'failed'
        : result.entry.changes.length
          ? result.entry.skipped.length
            ? 'partial'
            : 'applied'
          : 'unchanged';
      result.entry.error = error ?? null;
      try {
        await send(
          new TransactWriteCommand({
            TransactItems: [
              postingPut(table, job.pk, next, row.data),
              putJob(job, result, job.data),
              ...(await urlWrites(job.pk, item, next)),
              ...companyMembershipWrites(
                table,
                job.pk,
                next,
                item.companyAssociation,
                next.companyAssociation,
              ),
            ],
          }),
          signal(),
        );
        return;
      } catch (cause) {
        const latest = await readRow(table, send, job.pk, job.sk, signal());
        if (!latest || latest.data !== job.data) return;
        const latestPosting = await readRow(
          table,
          send,
          job.pk,
          job.recordKey,
          signal(),
        );
        if (latestPosting?.data === row.data) {
          // A colliding URL can be saved concurrently without changing this posting.
          if (
            next.sourceUrl !== item.sourceUrl &&
            (await readRow(
              table,
              send,
              job.pk,
              `URL#${hash(next.sourceUrl)}`,
              signal(),
            ))
          )
            continue;
          throw cause;
        }
      }
    }
    throw postingError('CONFLICT');
  }
  async function run(pk: string, sk: string) {
    const value = await readRow(table, send, pk, sk, signal());
    if (!value) return;
    const { job, data } = readJob(value, pk, sk);
    if (job.status !== 'queued') return;
    if (!parse) {
      await finish(job, data, undefined, 'Role updates are unavailable.');
      return;
    }
    const row = await readRow(table, send, pk, job.recordKey, signal());
    if (!row || typeof row.data !== 'string') return;
    const item = readRecord(row, pk, job.recordKey);
    if (item.edits?.pending !== sk) return;
    const claimed = structuredClone(data);
    claimed.entry.status = 'processing';
    try {
      await send(
        new TransactWriteCommand({
          TransactItems: [
            postingPut(
              table,
              pk,
              { ...item, recordVersion: item.recordVersion + 1 },
              row.data,
            ),
            putJob(job, claimed, job.data),
          ],
        }),
        signal(),
      );
    } catch (cause) {
      const latest = await readRow(table, send, pk, sk, signal());
      if (!latest || latest.data !== job.data) return; // An uncertain claim never authorizes another paid call.
      throw cause;
    }
    const processing = {
      ...job,
      status: 'processing' as const,
      data: boundedData(claimed),
    };
    try {
      const recent = await history(pk.slice('USER#'.length), job.roleId, {});
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: data.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(data.entry.createdAt));
      const part = (name: string) =>
        parts.find((item) => item.type === name)?.value;
      const today = `${part('year')}-${part('month')}-${part('day')}`;
      const context: UpdateEntry[] = [];
      let size = 0;
      for (const entry of recent.items) {
        if (
          entry.id === data.entry.id ||
          ['queued', 'processing', 'failed'].includes(entry.status)
        )
          continue;
        size += JSON.stringify(entry).length;
        if (size > 20_000) break;
        context.unshift(entry);
      }
      const output = modelUpdatesSchema.parse(
        await parse(
          {
            text: data.entry.text,
            current: data.baseline,
            history: context,
            today,
          },
          AbortSignal.timeout(60_000),
        ),
      );
      await finish(processing, claimed, output);
    } catch {
      await finish(
        processing,
        claimed,
        undefined,
        'The update could not finish. Review the role before retrying.',
      );
    }
  }
  async function recover(pk: string, sk: string) {
    const value = await readRow(table, send, pk, sk, signal());
    if (!value) return;
    const { job, data } = readJob(value, pk, sk);
    if (
      ['queued', 'processing'].includes(job.status) &&
      (job.dueAt ?? Infinity) <= now()
    )
      await finish(
        job,
        data,
        undefined,
        'The update was interrupted. Review the role before retrying.',
      );
  }
  async function undo(user: string, id: string, operation: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await lookup(user, id);
      const saved = await getOperation(found.pk, id, operation);
      if (!saved) throw postingError('NOT_FOUND');
      const { job, data } = saved;
      if (data.entry.undoneAt) return data.entry;
      if (found.item.edits?.pending || !data.entry.changes.length)
        throw postingError('CONFLICT');
      const fields = effectiveUpdateFields(found.item);
      const next = structuredClone(found.item);
      if (data.appliedCompanyRevision !== undefined) {
        if (
          found.item.companyAssociation?.revision !==
          data.appliedCompanyRevision
        )
          throw postingError('CONFLICT');
        next.companyAssociation = {
          ...(data.beforeCompanyAssociation ?? {
            company: null,
            mode: 'automatic' as const,
          }),
          revision: data.appliedCompanyRevision + 1,
        };
      }
      for (const change of data.entry.changes) {
        if (
          !same(fields[change.field], change.after) ||
          next.edits?.revisions[change.field] !==
            data.appliedRevisions[change.field]
        )
          throw postingError('CONFLICT');
        writeField(next, change.field, change.before);
        if (
          change.field !== 'sourceUrl' &&
          !(change.field in applicationSchema.shape) &&
          next.edits
        ) {
          const key = change.field as keyof typeof data.beforeOverrides;
          delete next.edits.overrides[key];
          if (Object.hasOwn(data.beforeOverrides, key))
            Object.assign(next.edits.overrides, {
              [key]: data.beforeOverrides[key],
            });
        }
      }
      next.recordVersion++;
      if (
        data.entry.changes.some(
          (change) => change.field in applicationSchema.shape,
        )
      )
        next.applicationVersion++;
      next.updatedAt = new Date(now()).toISOString();
      const result = structuredClone(data);
      result.entry.undoneAt = next.updatedAt;
      try {
        await send(
          new TransactWriteCommand({
            TransactItems: [
              postingPut(table, found.pk, next, found.previous),
              putJob(job, result, job.data),
              ...(await urlWrites(found.pk, found.item, next)),
              ...companyMembershipWrites(
                table,
                found.pk,
                next,
                found.item.companyAssociation,
                next.companyAssociation,
              ),
            ],
          }),
          signal(),
        );
        return result.entry;
      } catch (cause) {
        const recovered = await getOperation(found.pk, id, operation);
        if (recovered?.data.entry.undoneAt) return recovered.data.entry;
        const current = await lookup(user, id);
        if (current.previous === found.previous) throw cause;
      }
    }
    throw postingError('CONFLICT');
  }
  return {
    submit: (user: string, id: string, input: UpdateMessage) =>
      storageOperation(signal(), () => submit(user, id, input)),
    history: (user: string, id: string, query: { cursor?: string }) =>
      storageOperation(signal(), () => history(user, id, query)),
    undo: (user: string, id: string, operation: string) =>
      storageOperation(signal(), () => undo(user, id, operation)),
    run,
    recover,
  };
}
export type RoleUpdates = ReturnType<typeof createRoleUpdates>;
