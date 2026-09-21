# Serverless Framework v4 — huntinwabbit-boilerplate

[serverless.yml](../serverless.yml) owns service, runtime, resources and packaging. The distinct
`huntinwabbit-boilerplate` service creates stacks separate from the original application. Supply
SERVERLESS_ORG and AWS credentials/profile through local configuration. Never change its name to
an existing application's stack to test this starter. No deployed boilerplate is assumed.

## Build and package

Framework v4 bundles source handlers with built-in esbuild; local TypeScript build output is not
the deployment input. Keep [esbuild.config.mjs](../esbuild.config.mjs): its createRequire banner
supports CommonJS dependencies in the ESM bundle. Source-map generation and runtime enablement are
paired. Do not introduce a competing build plugin.

After installing dependencies, `npx serverless package --stage dev` creates ignored `.serverless/`
artifacts. Packaging can require CLI authentication/network access but is not deployment. Never print
rendered configuration: it can contain environment values. `npm run check:package` checks the archive,
loads its actual Lambda handler and tests public health, rejection and a signed hello request with
fictional keys and intercepted discovery. It needs `unzip` and the project's Node runtime.

## Security and operations

The API uses a Lambda Function URL with application bearer authentication, not API Gateway or AWS
IAM caller authentication. Health is public; all other app routes pass through JWT verification.
The function receives SUPABASE_URL only and needs basic execution/logging permissions. There are no
application tables, queues, scheduled workers, data IAM grants, native fetch binaries or AI secrets.

Environment files, tests and generated test output must not ship. Keep runtime configuration separate
from deployment credentials. Review the generated package and resource declarations before an
explicitly authorized deployment. Package checks do not prove AWS permissions or hosted behavior.

`npm run deploy:dev` and `npm run deploy:prod` are explicit external mutations. Do not deploy or
remove stacks merely to complete tests. Supabase configuration is a separate shared-project operation;
a unique AWS service name does not isolate shared auth policies or accounts.

After an authorized deployment, check health, unauthenticated rejection, valid/invalid bearer tokens,
private caching and logging privacy against the selected Function URL. AWS may normalize headers;
verify observed behavior rather than inferring it from local Express. Log sources must not expose
credentials or token-bearing requests. Live verification is described in the [E2E guide](../e2e/e2e.AGENTS.md).
