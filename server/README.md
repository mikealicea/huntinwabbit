# huntinwabbit-boilerplate API

Express 5, Node 24 and TypeScript ESM on AWS Lambda through Serverless Framework v4.
Read [AGENTS.md](AGENTS.md) for architecture, workflow and gates.

## Local setup

Run `mise install` and `mise exec -- npm ci` here. Copy [.env.example](.env.example) to ignored
`.env`, supply your existing hosted Supabase URL, then run `mise exec -- npm run dev`.
The example uses port 3001 so the web app can run on port 3000.

`GET /health` returns a public liveness response. `GET /` requires a valid Supabase user bearer
token and returns the Hello World message. The API verifies signature, issuer, audience and expiry;
it does not manage accounts, application records or sessions. The web app forwards tokens server-side.
Do not put access tokens in URLs or logs. See [authentication](src/features/auth/auth.AGENTS.md).

## Verification and deployment

Run `npm run check-types && npm run check && npm test && npm run build` under mise.
HTTP tests require local socket permission. Tests inject provider discovery and use fictional keys.
The optional `npm run test:e2e` requires explicit credentials and an API target; see
[live verification](e2e/e2e.AGENTS.md). It is separate from the offline gate.

[serverless.yml](serverless.yml) owns the distinct `huntinwabbit-boilerplate` service. It provisions
only the API function, Function URL and basic execution/logging infrastructure. No application
storage or worker resources are declared. See [packaging and deployment](docs/SERVERLESS-V4.AGENTS.md).
