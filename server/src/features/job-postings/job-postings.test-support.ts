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
        .sort((a, b) => String(b.sk).localeCompare(String(a.sk)));
      return { Items: structuredClone(all) };
    }
    const puts = command.input.TransactItems?.map((entry) => entry.Put) ?? [];
    for (const put of puts) {
      if (!put?.Item) throw new Error('Expected put');
      const existing = rows.get(key(put.Item.pk, put.Item.sk));
      const condition = put.ConditionExpression;
      if (condition === 'attribute_not_exists(pk)' && existing)
        throw new Error('Conditional conflict');
      if (
        condition === '#data = :previous' &&
        existing?.data !== put.ExpressionAttributeValues?.[':previous']
      )
        throw new Error('Conditional conflict');
      if (
        condition === '#status = :status' &&
        existing?.status !== put.ExpressionAttributeValues?.[':status']
      )
        throw new Error('Conditional conflict');
    }
    for (const put of puts)
      if (put?.Item)
        rows.set(key(put.Item.pk, put.Item.sk), structuredClone(put.Item));
    return {};
  };
  return { rows, send };
}
