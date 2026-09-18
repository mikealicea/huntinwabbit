# React architecture verification

This directory owns automated checks for the [React architecture convention](../../docs/react-architecture.AGENTS.md).
It does not run in the application or alter runtime behavior. The [web guide](../../AGENTS.md) owns
required gates; [package.json](../../package.json) owns their commands.

[architecture.check.ts](architecture.check.ts) uses TypeScript's syntax tree, module resolution and
symbol aliases to check JSX-owner filenames and container function names. Presentation dependency
traversal follows named imports through re-exports to executable owners and follows local helpers.
Type-only dependencies are ignored; namespace/dynamic dependencies inspect the module's exports.
The checker rejects coordination modules and external adapters from presentation graphs and limits
React runtime imports to UI hooks/helpers. Next Link/Image are explicit declarative UI exceptions.
Framework route files and the existing Nextra MDX integration have naming exceptions.

[architecture.test.ts](architecture.test.ts) runs the checker against the real application and
isolated fixtures for aliases, barrels, external adapters, local hooks, dynamic imports and naming.
Fixtures use temporary directories removed in `finally`. `npm run test:architecture` runs these tests;
`npm test` also includes them. No new runtime dependency or build plugin is needed.

This is an import/convention guard, not a security boundary or a proof of purity. It cannot judge
component size, appropriate state lifetime, arbitrary runtime indirection or all effects hidden in
third-party packages. Keep new vendor dependencies and exceptions explicit and reviewed; do not
rename a connected view as a provider to bypass the rules. Meaningful behavior tests, framework
builds and code review remain necessary.
