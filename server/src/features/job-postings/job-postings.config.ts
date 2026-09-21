export function jobPostingsTable(
  env: Record<string, string | undefined>,
): string | undefined {
  const table = env.JOB_POSTINGS_TABLE;
  if (table === undefined || table === '') return undefined;
  if (!/^[a-zA-Z0-9_.-]{3,255}$/.test(table))
    throw new Error('JOB_POSTINGS_TABLE must be a valid DynamoDB table name.');
  return table;
}
