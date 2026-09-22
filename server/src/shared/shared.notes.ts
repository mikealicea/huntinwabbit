import { createHash } from 'node:crypto';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  createNoteSchema,
  deleteNoteSchema,
  editNoteSchema,
  type Note,
  noteSchema,
  notesPageSchema,
  notesQuerySchema,
} from './shared.notes.schemas.ts';
export type NotesTransport = (
  command: GetCommand | QueryCommand | TransactWriteCommand,
  signal: AbortSignal,
) => Promise<unknown>;
type ErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_CURSOR'
  | 'INVALID_STORED_POSTING';
export async function readNoteRow(
  table: string,
  send: NotesTransport,
  pk: string,
  sk: string,
  signal: AbortSignal,
) {
  const result = z
    .object({ Item: z.record(z.string(), z.unknown()).optional() })
    .parse(
      await send(
        new GetCommand({
          TableName: table,
          Key: { pk, sk },
          ConsistentRead: true,
        }),
        signal,
      ),
    );
  return result.Item;
}
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

export function createNotesStore<
  T extends { pk: string; previous: string; recordKey: string },
>({
  table,
  send,
  lookup,
  parentWrites,
  bounded,
  error: postingError,
  prefix,
  now = Date.now,
}: {
  table: string;
  send: NotesTransport;
  lookup: (user: string, id: string, signal: AbortSignal) => Promise<T>;
  parentWrites: (found: T, timestamp: string, deleting: boolean) => Writes;
  bounded: <V>(work: (signal: AbortSignal) => Promise<V>) => Promise<V>;
  error: (code: ErrorCode, cause?: unknown) => Error;
  prefix: string;
  now?: () => number;
}) {
  function entry(
    value: unknown,
    pk: string,
    key: string,
    roleId: string,
    postingKey: string,
  ): Note {
    try {
      const row = rowSchema.parse(value);
      const note = noteSchema.parse(JSON.parse(row.data));
      if (
        row.pk !== pk ||
        row.sk !== key ||
        row.recordKey !== postingKey ||
        key !== `${prefix}#${roleId}#ENTRY#${note.createdAt}#${note.id}` ||
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
    const key = `${prefix}#${roleId}#ID#${noteId}`;
    const raw = await readNoteRow(table, send, pk, key, signal);
    if (!raw) return undefined;
    try {
      const pointer = pointerSchema.parse(raw);
      if (
        pointer.pk !== pk ||
        pointer.sk !== key ||
        pointer.recordKey !== postingKey ||
        !pointer.entryKey.startsWith(`${prefix}#${roleId}#ENTRY#`) ||
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
    const entryPrefix = `${prefix}#${roleId}#ENTRY#`;
    let after: string | undefined;
    if (input.cursor) {
      try {
        const cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
        );
        if (
          cursor.owner !== hash(found.pk) ||
          cursor.roleId !== roleId ||
          !cursor.after.startsWith(entryPrefix)
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
              ':prefix': entryPrefix,
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
    if (last && (last.pk !== found.pk || !last.sk.startsWith(entryPrefix)))
      throw postingError('INVALID_STORED_POSTING');
    const items = page.Items.map((raw) => {
      const row = rowSchema.parse(raw);
      return entry(raw, found.pk, row.sk, roleId, found.recordKey);
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
  ): Promise<Note | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await lookup(user, roleId, signal);
      const postingKey = found.recordKey;
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
        ? await readNoteRow(table, send, found.pk, pointer.entryKey, signal)
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
        pointer?.entryKey ?? `${prefix}#${roleId}#ENTRY#${timestamp}#${noteId}`;
      const writes = parentWrites(found, timestamp, action === 'delete');
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
              sk: `${prefix}#${roleId}#ID#${noteId}`,
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
export type NotesStore = ReturnType<typeof createNotesStore>;
