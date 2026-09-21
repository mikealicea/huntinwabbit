#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDocumentationAudit } from './documentation-structure.mjs';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const policy = JSON.parse(
  fs.readFileSync(path.join(scriptsDirectory, 'documentation-policy.json'), 'utf8'),
);
const result = runDocumentationAudit(repositoryRoot, policy);

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (result.errors.length > 0) {
  process.stderr.write(`Documentation structure failed with ${result.errors.length} error(s):\n`);
  for (const error of result.errors) process.stderr.write(`- ${error}\n`);
} else {
  process.stdout.write(
    `Documentation structure passed (${result.documentCount} owned documents; `
      + `${result.checkedLinkCount} current documents link-checked).\n`,
  );
}

process.exitCode = result.errors.length === 0 ? 0 : 1;
