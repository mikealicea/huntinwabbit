# Serverless Framework v4 — huntinwabbit

Read the [server guide](../AGENTS.md) before changing deployment configuration. Exact values belong
to [serverless.yml](../serverless.yml), [esbuild.config.mjs](../esbuild.config.mjs),
[package.json](../package.json) and its lockfile. This guide explains the operational boundaries.
The current service and organization values are inherited boilerplate, not a verified deployment.

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

The current function uses a Lambda Function URL, not an API Gateway HTTP API. No application
authentication or custom data resources are configured. Select intentional service, organization,
stage, region and access boundaries before deploying anything that handles personal data.

For new configuration, reconcile the stage value, environment parser, dependency construction,
resource access and tests together. Disabled and configured-but-broken capabilities are different
states. Keep local bypasses out of deployed composition.

Keep credentials and rendered templates out of Git. A deploy-time SSM lookup is not equivalent to
runtime secret retrieval: consider where plaintext ends up and which principal can read it. Give
each adapter only the actions and resource access it actually needs. Verify all entry points that
construct it, not just a passing fake-adapter test. Adding storage also requires an explicit retention,
delete/recovery and migration contract in the owning feature barrel.

Use the official [parameters](https://www.serverless.com/framework/docs/guides/parameters) and
[IAM](https://www.serverless.com/framework/docs/providers/aws/guide/iam) references for new infrastructure
(reviewed 2026-09-17). No queues, schedules, secret store or permission convergers are implemented here.
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
