import { createHash } from 'node:crypto';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  type DynamoTransport,
  readRecord,
  recordKey,
  storageOperation,
} from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import {
  createNoteSchema,
  deleteNoteSchema,
  editNoteSchema,
  noteSchema,
  notesPageSchema,
  notesQuerySchema,
  type RoleNote,
} from './job-postings.notes.schemas.ts';
import { postingPut, readRow } from './job-postings.operations.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const pointerSchema = z.strictObject({
  pk: z.string(),
  sk: z.string(),
  recordKey: z.string(),
  entryKey: z.string(),
  originalHash: z.string().regex(/^[a-f0-9]{64}$/),
  deleted: z.boolean(),
});
const rowSchema = z.strictObject({
  pk: z.string(),
  sk: z.string(),
  recordKey: z.string(),
  data: z.string(),
});
const cursorSchema = z.strictObject({
  owner: z.string(),
  roleId: z.uuid(),
  after: z.string(),
});
type Writes = NonNullable<TransactWriteCommandInput['TransactItems']>;

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
    return { pk, item, previous: row.data };
  }
  function entry(
    value: unknown,
    pk: string,
    key: string,
    roleId: string,
    postingKey: string,
  ): RoleNote {
    try {
      const row = rowSchema.parse(value);
      const note = noteSchema.parse(JSON.parse(row.data));
      if (
        row.pk !== pk ||
        row.sk !== key ||
        row.recordKey !== postingKey ||
        key !== `NOTE#${roleId}#ENTRY#${note.createdAt}#${note.id}` ||
        note.updatedAt < note.createdAt
      )
        throw new Error();
      return note;
    } catch (cause) {
      throw postingError('INVALID_STORED_POSTING', cause);
    }
  }
  async function getPointer(
    pk: string,
    roleId: string,
    noteId: string,
    postingKey: string,
    signal: AbortSignal,
  ) {
    const key = `NOTE#${roleId}#ID#${noteId}`;
    const raw = await readRow(table, send, pk, key, signal);
    if (!raw) return undefined;
    try {
      const pointer = pointerSchema.parse(raw);
      if (
        pointer.pk !== pk ||
        pointer.sk !== key ||
        pointer.recordKey !== postingKey ||
        !pointer.entryKey.startsWith(`NOTE#${roleId}#ENTRY#`) ||
        !pointer.entryKey.endsWith(`#${noteId}`)
      )
        throw new Error();
      return pointer;
    } catch (cause) {
      throw postingError('INVALID_STORED_POSTING', cause);
    }
  }
  async function list(
    user: string,
    roleId: string,
    input: z.infer<typeof notesQuerySchema>,
    signal: AbortSignal,
  ) {
    const found = await lookup(user, roleId, signal);
    const prefix = `NOTE#${roleId}#ENTRY#`;
    let after: string | undefined;
    if (input.cursor) {
      try {
        const cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
        );
        if (
          cursor.owner !== hash(found.pk) ||
          cursor.roleId !== roleId ||
          !cursor.after.startsWith(prefix)
        )
          throw new Error();
        after = cursor.after;
      } catch (cause) {
        throw postingError('INVALID_CURSOR', cause);
      }
    }
    const page = z
      .object({
        Items: z.array(z.unknown()).default([]),
        LastEvaluatedKey: z
          .strictObject({ pk: z.string(), sk: z.string() })
          .optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            ConsistentRead: true,
            KeyConditionExpression: 'pk = :owner AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: {
              ':owner': found.pk,
              ':prefix': prefix,
            },
            ScanIndexForward: false,
            Limit: 20,
            ...(after
              ? { ExclusiveStartKey: { pk: found.pk, sk: after } }
              : {}),
          }),
          signal,
        ),
      );
    const last = page.LastEvaluatedKey;
    if (last && (last.pk !== found.pk || !last.sk.startsWith(prefix)))
      throw postingError('INVALID_STORED_POSTING');
    const items = page.Items.map((raw) => {
      const row = rowSchema.parse(raw);
      return entry(raw, found.pk, row.sk, roleId, recordKey(found.item));
    });
    // Do not expose orphaned rows after a concurrent role deletion.
    await lookup(user, roleId, signal);
    return notesPageSchema.parse({
      schemaVersion: 1,
      items,
      nextCursor: last
        ? Buffer.from(
            JSON.stringify({ owner: hash(found.pk), roleId, after: last.sk }),
          ).toString('base64url')
        : null,
    });
  }
  async function mutate(
    user: string,
    roleId: string,
    noteId: string,
    action: 'create' | 'edit' | 'delete',
    body: string | undefined,
    revision: number | undefined,
    signal: AbortSignal,
  ): Promise<RoleNote | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await lookup(user, roleId, signal);
      const postingKey = recordKey(found.item);
      const pointer = await getPointer(
        found.pk,
        roleId,
        noteId,
        postingKey,
        signal,
      );
      if (pointer?.deleted) {
        if (action === 'delete') return null;
        throw postingError('CONFLICT');
      }
      const raw = pointer
        ? await readRow(table, send, found.pk, pointer.entryKey, signal)
        : undefined;
      const old = pointer
        ? entry(raw, found.pk, pointer.entryKey, roleId, postingKey)
        : undefined;
      if (action === 'create' && pointer) {
        if (pointer.originalHash !== hash(body ?? ''))
          throw postingError('CONFLICT');
        return old ?? null;
      }
      if (action !== 'create' && !old) {
        if (action === 'delete') return null;
        throw postingError('NOT_FOUND');
      }
      if (old && old.revision !== revision) {
        // Recover an acknowledged-lost edit only at its exact resulting revision.
        if (
          action === 'edit' &&
          old.revision === (revision ?? 0) + 1 &&
          old.body === body
        )
          return old;
        throw postingError('CONFLICT');
      }
      const timestamp = new Date(now()).toISOString();
      const note =
        action === 'delete'
          ? null
          : noteSchema.parse({
              id: noteId,
              body,
              createdAt: old?.createdAt ?? timestamp,
              updatedAt: timestamp,
              revision: (old?.revision ?? 0) + 1,
            });
      const entryKey =
        pointer?.entryKey ?? `NOTE#${roleId}#ENTRY#${timestamp}#${noteId}`;
      const writes: Writes = [
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
      ];
      const condition = raw
        ? {
            ConditionExpression: '#data = :previous',
            ExpressionAttributeNames: { '#data': 'data' },
            ExpressionAttributeValues: { ':previous': raw.data },
          }
        : { ConditionExpression: 'attribute_not_exists(pk)' };
      if (note)
        writes.push({
          Put: {
            TableName: table,
            Item: {
              pk: found.pk,
              sk: entryKey,
              recordKey: postingKey,
              data: JSON.stringify(note),
            },
            ...condition,
          },
        });
      else
        writes.push({
          Delete: {
            TableName: table,
            Key: { pk: found.pk, sk: entryKey },
            ...condition,
          },
        });
      if (action === 'create' || action === 'delete')
        writes.push({
          Put: {
            TableName: table,
            Item: {
              pk: found.pk,
              sk: `NOTE#${roleId}#ID#${noteId}`,
              recordKey: postingKey,
              entryKey,
              originalHash: pointer?.originalHash ?? hash(body ?? ''),
              deleted: action === 'delete',
            },
            ...(pointer
              ? {
                  ConditionExpression: 'recordKey = :key',
                  ExpressionAttributeValues: { ':key': postingKey },
                }
              : { ConditionExpression: 'attribute_not_exists(pk)' }),
          },
        });
      try {
        await send(new TransactWriteCommand({ TransactItems: writes }), signal);
        return note;
      } catch (cause) {
        // A fresh read recovers commits and rebases unrelated role changes.
        if (signal.aborted) throw cause;
        const latest = await lookup(user, roleId, signal);
        if (latest.previous === found.previous) throw cause;
      }
    }
    throw postingError('CONFLICT');
  }
  function bounded<T>(work: (signal: AbortSignal) => Promise<T>) {
    const signal = AbortSignal.timeout(10_000);
    return storageOperation(signal, () => work(signal));
  }
  return {
    list: (user: string, id: string, input: z.infer<typeof notesQuerySchema>) =>
      bounded((signal) =>
        list(user, id, notesQuerySchema.parse(input), signal),
      ),
    create: (
      user: string,
      id: string,
      input: z.infer<typeof createNoteSchema>,
    ) => {
      const valid = createNoteSchema.parse(input);
      return bounded((signal) =>
        mutate(user, id, valid.id, 'create', valid.body, undefined, signal),
      );
    },
    edit: (
      user: string,
      id: string,
      noteId: string,
      input: z.infer<typeof editNoteSchema>,
    ) => {
      const valid = editNoteSchema.parse(input);
      return bounded((signal) =>
        mutate(
          user,
          id,
          noteId,
          'edit',
          valid.body,
          valid.expectedRevision,
          signal,
        ),
      );
    },
    delete: (
      user: string,
      id: string,
      noteId: string,
      input: z.infer<typeof deleteNoteSchema>,
    ) => {
      const valid = deleteNoteSchema.parse(input);
      return bounded((signal) =>
        mutate(
          user,
          id,
          noteId,
          'delete',
          undefined,
          valid.expectedRevision,
          signal,
        ),
      );
    },
  };
}
export type RoleNotes = ReturnType<typeof createRoleNotes>;
