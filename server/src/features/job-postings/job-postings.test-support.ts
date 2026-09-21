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
            ? row.dueGroup === 'PENDING' &&
              Number(row.dueAt) <= Number(values?.[':now'])
            : row.pk === values?.[':owner'] &&
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
      const operation = entry.Put ?? entry.Delete;
      const address = entry.Put?.Item ?? entry.Delete?.Key;
      if (!operation || !address) throw new Error('Expected put or delete');
      const existing = rows.get(key(address.pk, address.sk));
      const condition = operation.ConditionExpression;
      const values = operation.ExpressionAttributeValues;
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
    for (const entry of entries) {
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
