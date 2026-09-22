# Serverless Framework v4 — huntinwabbit

Read the [server guide](../AGENTS.md) before changing deployment configuration. Exact values belong
to [serverless.yml](../serverless.yml), [esbuild.config.mjs](../esbuild.config.mjs),
[package.json](../package.json) and its lockfile. This guide explains the operational boundaries.
Operators supply their own Serverless organization through SERVERLESS_ORG and their own AWS
credentials or AWS_PROFILE. There is no checked-in organization or AWS account target. The stack is
`huntinwabbit-<stage>` in the configured account and region. Production deployment remains separate work.

## Build and packaging

Framework v4 bundles TypeScript source handlers with built-in esbuild. Our handler points at
`src/lambda.handler`; local `npm run build` output is not the deployment input. Do not add a second
build plugin while the built-in build is active. The major constraint and installed CLI dependency
are separate owners; a major constraint alone is not an exact CLI pin.

Keep the esbuild config file when changing bundling: its banner supplies `createRequire` for CommonJS
dependencies in the ESM bundle. Source-map generation and runtime source-map enablement in YAML are
paired. There is no Sentry preload, upload plugin or Lambda layer configured here.

This was checked against the official [build configuration](https://www.serverless.com/framework/docs/providers/aws/guide/building)
on 2026-09-17. Recheck changes against the installed CLI; do not transplant an older generic skeleton
or assume every upstream option exists in the locked version.

## Configuration, secrets and IAM

The current function uses a Lambda Function URL, not an API Gateway HTTP API. Application bearer authentication runs in Express for all routes after public health. Saved-posting DynamoDB tables and runtime IAM are configured; no gateway authorizer is configured. Select intentional service, organization,
stage, region and access boundaries before deploying anything that handles personal data.

For new configuration, reconcile the stage value, environment parser, dependency construction,
resource access and tests together. Disabled and configured-but-broken capabilities are different
states. Keep local bypasses out of deployed composition.

SERVERLESS_ORG and SUPABASE_URL are required during packaging/deployment, with no fallback.
Keep actual values in ignored `server/.env`, stage-specific dotenv files or deployment configuration;
the [environment example](../.env.example) contains placeholders. SERVERLESS_ORG selects the
Serverless Framework organization, not AWS credentials, and is not passed to Lambda.
The [Framework environment-variable reference](https://www.serverless.com/framework/docs/guides/variables/env-vars)
documents dotenv loading and interpolation (checked 2026-09-21).
SUPABASE_URL is passed to Lambda. The
[auth parser](../src/features/auth/auth.config.ts) validates it at runtime construction. Public-key
verification requires no runtime API key or signing secret.

Keep credentials and rendered templates out of Git. A deploy-time SSM lookup is not equivalent to
runtime secret retrieval: consider where plaintext ends up and which principal can read it. Give
each adapter only the actions and resource access it actually needs. Verify all entry points that
construct it, not just a passing fake-adapter test. Adding storage also requires an explicit retention,
delete/recovery and migration contract in the owning feature barrel.

Use the official [parameters](https://www.serverless.com/framework/docs/guides/parameters) and
[IAM](https://www.serverless.com/framework/docs/providers/aws/guide/iam) references for new infrastructure
(reviewed 2026-09-17). The saved-postings worker has a stream failure queue and scheduled recovery; no secret store or permission converger is implemented.
If queues arrive, review visibility, function/provider deadlines, retry and dead-letter policies as
one chain rather than independent numeric settings.

## Verification and operations

Run the normal server gate first. For deployment/configuration changes, inspect a local package:

```bash
npx --no-install serverless package --stage dev
```

The [packaging command](https://www.serverless.com/framework/docs/providers/aws/guide/packaging)
produces `.serverless/` artifacts without deploying them (reference checked 2026-09-17). It may need
CLI authentication, network access and variable-resolution credentials. Treat its rendered output
as sensitive and do not commit it. Inspect handler exports, bundled runtime dependencies, source maps
and generated resource/IAM configuration; YAML parsing or `tsc` alone cannot prove these.

When packaging cannot run, report that limitation and the local checks completed. Do not obtain a
successful result by removing required configuration or using an unrelated account.

Deployments, remote invocations, live evaluations and vendor configuration are separate operations.
Run them only for the target and action authorized by the task. `serverless dev` can replace a deployed
function with a local-development shim; ordinary HTTP work uses `npm run dev`. A successful package
does not prove production permissions or runtime behavior; plan target-specific smoke tests when
an actual deployment is authorized.

After an authorized deployment, run `npm run test:e2e` with the explicit target and dedicated-user
configuration described in the [E2E guide](../e2e/e2e.AGENTS.md). It signs in, checks the live API and
signs out its own session. It does not deploy or prove that the running artifact matches local source.

## Verified dev deployment

On 2026-09-19, the packaged service was deployed to the maintainer's dev stack.
CloudFormation reported `CREATE_COMPLETE`, and the Node 24 Lambda
reported `Active` with a successful update. The actual Function URL is kept in ignored deployment environment files; obtain your own target from deployment outputs.

Live checks returned public health 200 and protected-route 401 for missing credentials, malformed
tokens, the wrong scheme, query/cookie credentials, comma-joined credentials and a forged signature
using the hosted signing-key ID. These 401 responses retained `Cache-Control: no-store` and the
generic error body. Repeated Authorization header fields were rejected by the AWS front end with
400 before reaching Express.

A dedicated development user was provisioned through the Supabase admin API on the same date.
A real password sign-in issued an ES256 access token, and the Function URL returned 200 with
`{"message":"Hello, world!"}` and `Cache-Control: no-store` when given that token. A following
request without credentials returned 401. The test session was signed out afterward. This was a
direct API check; browser sign-in and email delivery were not exercised. The development browser
connection was unavailable.

The automated `npm run test:e2e` suite subsequently passed all 13 scenarios against this dev
deployment on 2026-09-19, including dedicated-user sign-in and session teardown. The offline suite
remained separate and passed 56 tests.

The same live response inspection found that the Function URL remaps `WWW-Authenticate` to
`x-amzn-Remapped-www-authenticate`. Local and Lambda-handler tests establish the application header,
but clients of this deployment do not receive a standard bearer-challenge header. This is a known
transport limitation; changing the front door is separately scoped work.

## Job parser native packaging

The parsing feature uses agent-fetch as an external dependency. Its native HTTP library must be
installed for Lambda, not the packaging machine. The [esbuild config](../esbuild.config.mjs) sets
npm's target OS/CPU/libc before Serverless installs externals; the deployment architecture is explicit
in [serverless.yml](../serverless.yml). A macOS-default install was observed to omit the Linux
HTTP library. Selecting Linux/glibc also includes the canvas dependency pulled in by PDF support,
even when parsing HTML. Package inspection alone catches missing files but does not prove native loading.

Package without a runtime key for offline verification:

```sh
JOB_PARSING_ENABLED=false REDPILL_API_KEY='' npx --no-install serverless package --stage dev
npm run check:package
```

The [package check](../scripts/scripts.AGENTS.md) exercises the actual archive in the AWS Node 24
Linux image without networking. Docker must be running. Deployment remains separate: set the
capability flag and key intentionally for an authorized target. Serverless environment variables
can put the key in generated templates/state; never print or commit those artifacts. The runtime
key is not needed for packaging checks and no secret-store IAM is introduced.

The Lambda timeout/memory budget now accommodates the bounded synchronous fetch and inference
phases. These source changes are not evidence that the previously verified dev deployment has
been updated. Source gate, local build, package check and live inference are distinct checks.

## Saved-posting storage and extraction

The stage-specific table reference is passed as JOB_POSTINGS_TABLE. It has on-demand billing,
encryption, PITR and retain policies. API, extraction and recovery roles are separate. All writes
use conditional transactions; runtime roles cannot scan. API, recovery and extraction roles can delete within
transactions; the extraction role moves source URL pointers and fences old jobs during role updates. Scheduled recovery also advances durable posting
deletion cleanup markers through the pending index. The recovery role alone can query the
sparse pending-job index. The worker consumes only INSERT job-key events from a KEYS_ONLY stream.
Exact timeout, retention, retry, alarm and IAM settings belong to serverless.yml and the
[saved-postings barrel](../src/features/job-postings/job-postings.AGENTS.md).

The locked AWS SDK is bundled using negated patterns in both esbuild external/exclude; empty lists
do not override Serverless defaults (verified with installed v4.39.0 on 2026-09-21). Run
`npm run check:storage-package` after packaging to inspect the table/index, runtime references,
scoped IAM, worker/recovery configuration and SDK inclusion without Docker or live writes.

A deployment is distinct from a package check. After authorized dev deployment, run the operator
ID-pointer migration and dedicated-account save/detail/update/extraction checks. Do not print
resolved environment values or actual private test data. Published setup examples must use your
own deployment targets; no maintainer API or Supabase project is a fallback.

## Live integration verification

On 2026-09-21, the dev stack was updated with saved-role lookup/updates, the extraction worker and
scheduled recovery. The ID-pointer migration found no legacy records. Dedicated-account live checks
passed save, duplicate recovery, direct lookup, tracking updates, stale-version conflicts and private
listing; the existing thirteen live authentication checks also passed.

A Chromium session using the local frontend against dev saved a fresh link, closed and reopened its
browser context after acceptance, edited notes during extraction, and observed successful generated
facts and preserved notes after reload. The session was signed out. Two dedicated smoke records remain;
there is no delete API. The initial worker entry filename was rejected by Lambda; the corrected
`src/extraction.ts` entry is deployed and package inspection now checks both worker handler names.
The first failed delivery made no inference call. One subsequent live extraction completed. These
checks establish the tested dev path, not all posting sites, production, backups or screen-reader use.

## Company analysis packaging

The [analysis feature](../src/features/company-analysis/company-analysis.AGENTS.md) adds a separate
stream mapping and worker, a scheduled analysis recovery function, failure queue and alarms.
Analysis recovery uses the recovery IAM role and receives no provider key. Posting/API writes now
need transactional UpdateItem for company revisions; analysis publication also uses conditional
checks. The storage package checker verifies these resources. Deploy all affected functions and IAM
together; enabling or live evaluation remains a separately authorized operation.
