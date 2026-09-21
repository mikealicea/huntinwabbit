# Server package verification

[check-package.mjs](check-package.mjs), exposed as `npm run check:package`, inspects the generated
boilerplate archive, rejects environment files, and invokes its actual Lambda handler in a separate
Node process. The process uses fictional ES256 keys and intercepts signing-key discovery; unexpected
fetch targets fail. Checks cover public health, unauthenticated denial and authenticated hello.

Generate the archive using the [packaging guide](../docs/SERVERLESS-V4.AGENTS.md). The script requires
`unzip` and the pinned Node runtime, uses a temporary directory, and removes it in `finally`.
No AWS calls, hosted account mutations, Docker or deployment are involved in the check itself.
It does not establish IAM permissions, remote provider compatibility or hosted logging behavior.
