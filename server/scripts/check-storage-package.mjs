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
assert.equal(
  table.Properties.GlobalSecondaryIndexes[0].IndexName,
  'PendingJobs',
);
assert.equal(table.Properties.StreamSpecification.StreamViewType, 'KEYS_ONLY');
assert.equal(table.Properties.TimeToLiveSpecification.Enabled, true);
const mapping = template.Resources.ExtractionMapping.Properties;
assert.equal(mapping.BatchSize, 1);
assert.equal(mapping.StartingPosition, 'TRIM_HORIZON');
assert.equal(mapping.MaximumRetryAttempts, 2);
assert.equal(mapping.MaximumRecordAgeInSeconds, 3600);
assert.equal(
  template.Resources.ExtractionLambdaFunction.Properties.Timeout,
  90,
);
assert.equal(
  template.Resources.ExtractionFailures.Properties.SqsManagedSseEnabled,
  true,
);
assert.equal(
  template.Resources.ExtractionFailures.Properties.MessageRetentionPeriod,
  1209600,
);
const lambda = template.Resources.ApiLambdaFunction;
assert.deepEqual(lambda.Properties.Environment.Variables.JOB_POSTINGS_TABLE, {
  Ref: 'JobPostingsTable',
});
const statements = template.Resources.ApiRole.Properties.Policies.flatMap(
  (policy) => policy.PolicyDocument.Statement,
);
const dataStatements = statements.filter((statement) =>
  JSON.stringify(statement.Action).includes('dynamodb:'),
);
assert.equal(dataStatements.length, 2);
assert.deepEqual(
  dataStatements.flatMap((statement) => statement.Action).sort(),
  [
    'dynamodb:DeleteItem',
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:Query',
  ],
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
for (const role of ['ExtractionRole', 'RecoveryRole']) {
  const policies = template.Resources[role].Properties.Policies.flatMap(
    (policy) => policy.PolicyDocument.Statement,
  );
  assert(
    policies.some(
      (statement) =>
        statement.Action.includes('dynamodb:PutItem') &&
        statement.Condition.StringEquals['dynamodb:EnclosingOperation'] ===
          'TransactWriteItems',
    ),
  );
  assert.equal(
    policies.some((statement) =>
      statement.Action.includes('dynamodb:DeleteItem'),
    ),
    true,
  );
  for (const statement of policies.filter((statement) =>
    statement.Action.includes('dynamodb:DeleteItem'),
  )) {
    assert.deepEqual(statement.Resource, {
      'Fn::GetAtt': ['JobPostingsTable', 'Arn'],
    });
    assert.equal(
      statement.Condition.StringEquals['dynamodb:EnclosingOperation'],
      'TransactWriteItems',
    );
  }
  assert(
    !policies.some((statement) => statement.Action.includes('dynamodb:Scan')),
  );
}
assert.equal(
  template.Resources.RecoveryLambdaFunction.Properties.Environment.Variables
    .REDPILL_API_KEY,
  undefined,
);
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
  'job-postings.updates.ts',
  'job-postings.updates.router.ts',
]) {
  assert(
    sourceMap.sources.some((source) => source.includes(name)),
    `Missing bundled source: ${name}`,
  );
}
assert(table.Properties.TableName.endsWith('-job-postings'));

assert.equal(
  template.Resources.ExtractionLambdaFunction.Properties.Handler,
  'src/extraction.handler',
);
assert.equal(
  template.Resources.RecoveryLambdaFunction.Properties.Handler,
  'src/extraction.recover',
);
const archive = execFileSync('unzip', [
  '-l',
  '.serverless/huntinwabbit.zip',
]).toString();
assert(archive.includes('src/extraction.js'));
console.log(
  'Storage package: stage table, retention, recovery, runtime reference, scoped IAM, extraction/recovery resources and bundled SDK verified. No AWS calls or Docker.',
);
