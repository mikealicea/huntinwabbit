import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoTransport } from './job-postings.dynamodb.ts';
export function memoryPostings() {
  const rows = new Map<string, Record<string, unknown>>();
  const key = (pk: unknown, sk: unknown) => `${pk}|${sk}`;
  const send: DynamoTransport = async (command, signal) => {
    signal.throwIfAborted();
    if (command instanceof GetCommand)
      return {
        Item: structuredClone(
          rows.get(key(command.input.Key?.pk, command.input.Key?.sk)),
        ),
      };
    if (command instanceof QueryCommand) {
      const values = command.input.ExpressionAttributeValues;
      const all = [...rows.values()]
        .filter((row) =>
          command.input.IndexName
            ? row.dueGroup === values?.[':group'] &&
              Number(row.dueAt) <= Number(values?.[':now'])
            : row.pk === (values?.[':owner'] ?? values?.[':pk']) &&
              String(row.sk).startsWith(String(values?.[':prefix'])),
        )
        .sort(
          (a, b) =>
            (command.input.ScanIndexForward === false ? -1 : 1) *
            String(a.sk).localeCompare(String(b.sk)),
        );
      const after = command.input.ExclusiveStartKey;
      const remaining = after
        ? all.filter((row) =>
            command.input.ScanIndexForward === false
              ? String(row.sk) < String(after.sk)
              : String(row.sk) > String(after.sk),
          )
        : all;
      const page = remaining.slice(0, command.input.Limit ?? remaining.length);
      const last = page.at(-1);
      return {
        Items: structuredClone(page),
        ...(last && page.length < remaining.length
          ? { LastEvaluatedKey: { pk: last.pk, sk: last.sk } }
          : {}),
      };
    }
    const entries = command.input.TransactItems ?? [];
    for (const entry of entries) {
      const operation =
        entry.Put ?? entry.Delete ?? entry.Update ?? entry.ConditionCheck;
      const address =
        entry.Put?.Item ??
        entry.Delete?.Key ??
        entry.Update?.Key ??
        entry.ConditionCheck?.Key;
      if (!operation || !address) throw new Error('Expected put or delete');
      const existing = rows.get(key(address.pk, address.sk));
      const condition = operation.ConditionExpression;
      const values = operation.ExpressionAttributeValues;
      // DynamoDB reserves HIDDEN. The fake must reject the same invalid
      // expression that would otherwise pass locally and fail on publication.
      if (
        /\bhidden\b/i.test(
          entry.Update?.UpdateExpression?.replace(/[#:]\w+/g, '') ?? '',
        )
      )
        throw Object.assign(new Error('Unaliased reserved attribute'), {
          name: 'ValidationException',
        });
      if (
        condition === 'generation = :generation AND version = :version' &&
        (existing?.generation !== values?.[':generation'] ||
          existing?.version !== values?.[':version'])
      )
        throw new Error('Conditional conflict');
      if (
        condition === '#status = :queued' &&
        existing?.status !== values?.[':queued']
      )
        throw new Error('Conditional conflict');
      if (
        condition === '#status = :claimed' &&
        existing?.status !== values?.[':claimed']
      )
        throw new Error('Conditional conflict');
      if (
        condition ===
          'attribute_exists(pk) AND (notesRevision = :previous OR attribute_not_exists(notesRevision))' &&
        (!existing ||
          (existing.notesRevision !== undefined &&
            existing.notesRevision !== values?.[':previous']))
      )
        throw new Error('Conditional conflict');
      if (condition === 'attribute_not_exists(pk)' && existing)
        throw new Error('Conditional conflict');
      if (
        condition === '#data = :previous' &&
        existing?.data !== values?.[':previous']
      )
        throw new Error('Conditional conflict');
      if (
        condition === '#status = :status' &&
        existing?.status !== values?.[':status']
      )
        throw new Error('Conditional conflict');
      if (
        condition === 'recordKey = :key' &&
        existing?.recordKey !== values?.[':key']
      )
        throw new Error('Conditional conflict');
      if (
        condition === 'attribute_not_exists(pk) OR recordKey = :key' &&
        existing &&
        existing.recordKey !== values?.[':key']
      )
        throw new Error('Conditional conflict');
      if (
        condition === 'revision = :revision' &&
        existing?.revision !== values?.[':revision']
      )
        throw new Error('Conditional conflict');
    }
    const keys = entries.map((entry) => {
      const address =
        entry.Put?.Item ??
        entry.Delete?.Key ??
        entry.Update?.Key ??
        entry.ConditionCheck?.Key;
      return key(address?.pk, address?.sk);
    });
    if (new Set(keys).size !== keys.length)
      throw new Error('Duplicate transaction item');
    for (const entry of entries) {
      if (entry.Update?.Key) {
        const address = entry.Update.Key,
          values = entry.Update.ExpressionAttributeValues;
        const existing = rows.get(key(address.pk, address.sk)) ?? {
          ...address,
        };
        if (entry.Update.UpdateExpression?.startsWith('SET revision')) {
          rows.set(key(address.pk, address.sk), {
            ...existing,
            revision: Number(existing.revision ?? 0) + 1,
            dueGroup: values?.[':group'],
            dueAt: values?.[':due'],
            ...(values?.[':hidden'] ? { hidden: true } : {}),
          });
        } else if (
          entry.Update.UpdateExpression === 'SET #hidden = :false' &&
          entry.Update.ExpressionAttributeNames?.['#hidden'] === 'hidden'
        ) {
          rows.set(key(address.pk, address.sk), { ...existing, hidden: false });
        } else if (
          entry.Update.UpdateExpression === 'SET notesRevision = :next'
        ) {
          rows.set(key(address.pk, address.sk), {
            ...existing,
            notesRevision: values?.[':next'],
          });
        } else throw new Error('Unsupported update');
      }
      if (entry.Put?.Item)
        rows.set(
          key(entry.Put.Item.pk, entry.Put.Item.sk),
          structuredClone(entry.Put.Item),
        );
      if (entry.Delete?.Key)
        rows.delete(key(entry.Delete.Key.pk, entry.Delete.Key.sk));
    }
    return {};
  };
  return { rows, send };
}
