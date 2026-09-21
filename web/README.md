# huntinwabbit-boilerplate web

Next.js frontend with public entry, Supabase authentication and a protected Hello World API demo.
Read [the project guide](AGENTS.md) before editing and [root setup](../README.md) to run both apps.

From this directory, run `mise install`, `mise exec -- npm ci`, then `mise exec -- npm run dev`.
Copy [.env.example](.env.example) to ignored `.env.local`; all authentication and backend settings
remain server-side. Use the same Supabase project as the API and point the dev API URL at the local
server. Missing backend configuration produces an honest error when calling the demo.

Run `npm run check-types && npm run check && npm test && npm run build` under mise.
Also run `npm run test:auth`, `npm run test:state`, `npm run test:architecture` and
`npm run test:e2e` for relevant changes. Browser tests use local fake credentials and send no email.
See [browser verification](e2e/e2e.AGENTS.md) and [socket permissions](../docs/runbooks/local-socket-verification.md).

The server bridge verifies identity before reading and forwarding a token. Browser code receives
only the hello message or a safe error; Redux never holds credentials. Routes, response handling
and cache lifetime belong to the [hello feature](src/features/hello/hello.AGENTS.md).
