import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Inspect only relevant configuration; never print rendered templates or secrets.
const template = JSON.parse(
  await readFile(
    '.serverless/cloudformation-template-update-stack.json',
    'utf8',
  ),
);
const table = template.Resources.JobPostingsTable;
assert.equal(table.Type, 'AWS::DynamoDB::Table');
assert.equal(table.DeletionPolicy, 'Retain');
assert.equal(table.UpdateReplacePolicy, 'Retain');
assert.equal(table.Properties.BillingMode, 'PAY_PER_REQUEST');
assert.deepEqual(table.Properties.KeySchema, [
  { AttributeName: 'pk', KeyType: 'HASH' },
  { AttributeName: 'sk', KeyType: 'RANGE' },
]);
assert.equal(
  table.Properties.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled,
  true,
);
assert.equal(table.Properties.SSESpecification.SSEEnabled, true);
assert.equal(table.Properties.GlobalSecondaryIndexes, undefined);
const lambda = template.Resources.ApiLambdaFunction;
assert.deepEqual(lambda.Properties.Environment.Variables.JOB_POSTINGS_TABLE, {
  Ref: 'JobPostingsTable',
});
const statements =
  template.Resources.IamRoleLambdaExecution.Properties.Policies.flatMap(
    (policy) => policy.PolicyDocument.Statement,
  );
const dataStatements = statements.filter((statement) =>
  JSON.stringify(statement.Action).includes('dynamodb:'),
);
assert.equal(dataStatements.length, 2);
assert.deepEqual(
  dataStatements.flatMap((statement) => statement.Action).sort(),
  ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'],
);
for (const statement of dataStatements) {
  assert.equal(statement.Effect, 'Allow');
  assert.deepEqual(statement.Resource, {
    'Fn::GetAtt': ['JobPostingsTable', 'Arn'],
  });
}
const writes = dataStatements.find((statement) =>
  statement.Action.includes('dynamodb:PutItem'),
);
assert.deepEqual(writes.Condition, {
  StringEquals: { 'dynamodb:EnclosingOperation': 'TransactWriteItems' },
});
const sourceMap = JSON.parse(
  execFileSync(
    'unzip',
    ['-p', '.serverless/huntinwabbit.zip', 'src/lambda.js.map'],
    { maxBuffer: 30 * 1024 * 1024 },
  ).toString(),
);
for (const name of [
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/lib-dynamodb',
  'job-postings.dynamodb.ts',
  'job-postings.router.ts',
]) {
  assert(
    sourceMap.sources.some((source) => source.includes(name)),
    `Missing bundled source: ${name}`,
  );
}
assert(table.Properties.TableName.endsWith('-job-postings'));
console.log(
  'Storage package: stage table, retention, recovery, runtime reference, scoped IAM and bundled SDK verified. No AWS calls or Docker.',
);
