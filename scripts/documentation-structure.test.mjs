import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import {
  classifyFile,
  globToRegExp,
  runDocumentationAudit,
  validateBarrelCoverage,
  validateFeatureDirectories,
  validateIndexCoverage,
  validateRelativeLinks,
  validateSymlinks,
} from './documentation-structure.mjs';

const fixtures = [];
after(() => {
  for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huntinwabbit-documentation-'));
  fixtures.push(root);
  return root;
}

const repositoryPolicy = JSON.parse(fs.readFileSync(
  new URL('./documentation-policy.json', import.meta.url), 'utf8',
));

function projectFixture() {
  const root = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  const documents = {
    '.gitignore': '/temp/\nnode_modules/\n.next/\n',
    'AGENTS.md': '[scripts](scripts/scripts.AGENTS.md)\n',
    'scripts/scripts.AGENTS.md': '# Scripts\n',
    'web/AGENTS.md': '[home](src/features/home/home.AGENTS.md)\n',
    'web/src/features/home/home.AGENTS.md': '# Home\n',
    'web/src/features/home/HomePage.tsx': '',
    'server/AGENTS.md': '[hello](src/features/hello/hello.AGENTS.md)\n',
    'server/src/features/hello/hello.AGENTS.md': '# Hello\n',
    'server/src/features/hello/hello.router.ts': '',
    'docs/README.md': '# Docs\n',
    'docs/oneOff/source.md': '[historical](old-path.md)\n',
    'product-workspace/huntinwabbit-projects.md': '# Projects\n',
    'product-workspace/research/huntinwabbit-research.md': '# Research\n',
    'temp/reference/AGENTS.md': '[ignored](missing.md)\n',
    'web/node_modules/vendor/README.md': '[ignored](missing.md)\n',
    'web/.next/README.md': '[ignored](missing.md)\n',
  };
  for (const [file, text] of Object.entries(documents)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  for (const directory of ['', 'web', 'server']) {
    fs.symlinkSync('AGENTS.md', path.join(root, directory, 'CLAUDE.md'));
  }
  return root;
}

test('huntinwabbit policy checks new application docs without auditing ignored reference trees', () => {
  const root = projectFixture();
  const result = runDocumentationAudit(root, repositoryPolicy);
  assert.deepEqual(result.errors, []);
  assert.equal(result.documentCount, 10);
  assert.equal(result.checkedLinkCount, 7);
  // Tracking a scratch document must bring it into the audit, even under an ignore rule.
  execFileSync('git', ['add', '-f', 'temp/reference/AGENTS.md'], { cwd: root });
  assert.ok(runDocumentationAudit(root, repositoryPolicy).errors.some(
    (error) => error.startsWith('temp/reference/AGENTS.md: expected one documentation owner'),
  ));
});

test('huntinwabbit policy rejects missing feature owners, aliases and unindexed adopted docs', () => {
  const root = projectFixture();
  fs.rmSync(path.join(root, 'web/src/features/home/home.AGENTS.md'));
  fs.rmSync(path.join(root, 'server/CLAUDE.md'));
  fs.writeFileSync(path.join(root, 'docs', 'new-contract.md'), '# Contract\n');
  const { errors } = runDocumentationAudit(root, repositoryPolicy);
  assert.ok(errors.includes('web/src/features/home: feature directory has no direct barrel'));
  assert.ok(errors.includes('server/CLAUDE.md: required documentation symlink is missing'));
  assert.ok(errors.includes('docs/README.md: does not mention indexed document docs/new-contract.md'));
  assert.ok(errors.includes('web/AGENTS.md: missing link target: src/features/home/home.AGENTS.md'));
});

test('glob matching distinguishes direct and recursive paths', () => {
  assert.equal(globToRegExp('docs/*.md').test('docs/current.md'), true);
  assert.equal(globToRegExp('docs/*.md').test('docs/nested/current.md'), false);
  assert.equal(globToRegExp('docs/**').test('docs/nested/current.md'), true);
  assert.equal(globToRegExp('docs/**/*.md').test('docs/current.md'), true);
  assert.equal(globToRegExp('docs/**/*.md').test('docs/nested/current.md'), true);
});

test('ownership classification respects exclusions', () => {
  const classes = [
    { name: 'current', include: ['docs/**'], exclude: ['docs/frozen/**'] },
    { name: 'frozen', include: ['docs/frozen/**'] },
    { name: 'imported', include: ['vendor/**'] },
  ];
  assert.deepEqual(classifyFile('docs/current.md', classes), ['current']);
  assert.deepEqual(classifyFile('docs/frozen/release.md', classes), ['frozen']);
  assert.deepEqual(classifyFile('vendor/instructions.md', classes), ['imported']);
});

test('relative links support spaces and headings', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs', 'folder with spaces'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'folder with spaces', 'target.md'), '# Exact Heading\n');
  fs.writeFileSync(
    path.join(root, 'docs', 'source.md'),
    '[target](<folder with spaces/target.md#exact-heading>)\n',
  );
  assert.deepEqual(
    validateRelativeLinks({ repositoryRoot: root, files: ['docs/source.md'] }),
    [],
  );
});

test('relative links report missing targets and repository escapes', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'source.md'), '[missing](none.md)\n[out](../../out.md)\n');
  const errors = validateRelativeLinks({ repositoryRoot: root, files: ['docs/source.md'] });
  assert.equal(errors.some((error) => error.includes('missing link target')), true);
  assert.equal(errors.some((error) => error.includes('escapes the repository')), true);
});

test('relative links reject targets reached through an escaping symlink', () => {
  const root = fixture();
  const outside = fixture();
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(outside, 'target.md'), '# Outside\n');
  fs.symlinkSync(path.join(outside, 'target.md'), path.join(root, 'docs', 'outside.md'));
  fs.writeFileSync(path.join(root, 'docs', 'source.md'), '[outside](outside.md)\n');
  const errors = validateRelativeLinks({ repositoryRoot: root, files: ['docs/source.md'] });
  assert.equal(errors.some((error) => error.includes('escapes the repository')), true);
});

test('barrel and feature checks report missing direct coverage', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'src', 'features', 'Capture'), { recursive: true });
  fs.writeFileSync(path.join(root, 'GUIDE.md'), '# Features\n');
  fs.writeFileSync(path.join(root, 'src', 'features', 'Capture', 'capture.ts'), '');
  const files = [
    'GUIDE.md',
    'src/features/Capture/Capture.AGENTS.md',
    'src/features/Capture/capture.ts',
  ];
  assert.deepEqual(validateBarrelCoverage({
    repositoryRoot: root,
    files,
    barrelIndexes: [{ guide: 'GUIDE.md', include: ['src/**/*.AGENTS.md'] }],
  }), ['GUIDE.md: does not mention barrel src/features/Capture/Capture.AGENTS.md']);
  assert.deepEqual(validateFeatureDirectories({
    files: files.filter((file) => !file.endsWith('.AGENTS.md')),
    featureDirectories: ['src/features'],
  }), ['src/features/Capture: feature directory has no direct barrel']);
});

test('feature coverage ignores directories with no repository files', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'src', 'features', 'Ignored'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'features', 'Ignored', 'scratch.txt'), 'ignored');
  assert.deepEqual(validateFeatureDirectories({
    files: [],
    featureDirectories: ['src/features'],
  }), []);
});

test('index coverage accepts path links and explicit wiki-link basenames', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '[current](current.md)\n[[project.index]]\n');
  const files = ['docs/README.md', 'docs/current.md', 'projects/project.index.md'];
  assert.deepEqual(validateIndexCoverage({
    repositoryRoot: root,
    files,
    documentIndexes: [
      { index: 'docs/README.md', include: ['docs/*.md'] },
      {
        index: 'docs/README.md',
        include: ['projects/*.index.md'],
        allowBasename: true,
      },
    ],
  }), []);
});

test('index coverage reports an unreachable selected document', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# Index\n');
  assert.deepEqual(validateIndexCoverage({
    repositoryRoot: root,
    files: ['docs/README.md', 'docs/current.md'],
    documentIndexes: [{ index: 'docs/README.md', include: ['docs/*.md'] }],
  }), ['docs/README.md: does not mention indexed document docs/current.md']);
});

test('index coverage does not accept a basename embedded in a different link', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '[[not-project.index]]\n');
  assert.deepEqual(validateIndexCoverage({
    repositoryRoot: root,
    files: ['docs/README.md', 'projects/project.index.md'],
    documentIndexes: [{
      index: 'docs/README.md',
      include: ['projects/*.index.md'],
      allowBasename: true,
    }],
  }), ['docs/README.md: does not mention indexed document projects/project.index.md']);
});

test('symlink validation checks both presence and target', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Guide\n');
  fs.symlinkSync('AGENTS.md', path.join(root, 'CLAUDE.md'));
  assert.deepEqual(validateSymlinks({
    repositoryRoot: root,
    requiredSymlinks: [{ path: 'CLAUDE.md', target: 'AGENTS.md' }],
  }), []);
});

test('symlink validation reports missing and incorrect aliases', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Guide\n');
  fs.symlinkSync('elsewhere.md', path.join(root, 'WRONG.md'));
  assert.deepEqual(validateSymlinks({
    repositoryRoot: root,
    requiredSymlinks: [
      { path: 'MISSING.md', target: 'AGENTS.md' },
      { path: 'WRONG.md', target: 'AGENTS.md' },
    ],
  }), [
    'MISSING.md: required documentation symlink is missing',
    'WRONG.md: expected target AGENTS.md',
  ]);
});

test('the repository audit reports unowned and overlapping documents', () => {
  const root = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'overlap.md'), '# Overlap\n');
  fs.writeFileSync(path.join(root, 'outside.md'), '# Unowned\n');
  execFileSync('git', ['add', '.'], { cwd: root });

  const result = runDocumentationAudit(root, {
    ownershipClasses: [
      { name: 'current', include: ['docs/**'] },
      { name: 'duplicate', include: ['docs/overlap.md'] },
    ],
    linkCheckClasses: ['current'],
    barrelIndexes: [],
    documentIndexes: [],
    featureDirectories: [],
    requiredSymlinks: [],
    deprecatedPrefixes: [],
  });
  assert.deepEqual(result.errors, [
    'docs/overlap.md: expected one documentation owner, found current, duplicate',
    'outside.md: expected one documentation owner, found none',
  ]);
});

test('the repository audit classifies frozen and imported documents without link-checking them', () => {
  const root = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs', 'frozen'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'current.md'), '# Current\n');
  fs.writeFileSync(path.join(root, 'docs', 'frozen', 'release.md'), '[historical](missing.md)\n');
  fs.writeFileSync(path.join(root, 'vendor', 'instructions.md'), '[imported](missing.md)\n');
  execFileSync('git', ['add', '.'], { cwd: root });

  const result = runDocumentationAudit(root, {
    ownershipClasses: [
      { name: 'current', include: ['docs/**'], exclude: ['docs/frozen/**'] },
      { name: 'frozen', include: ['docs/frozen/**'] },
      { name: 'imported', include: ['vendor/**'] },
    ],
    linkCheckClasses: ['current'],
    barrelIndexes: [],
    documentIndexes: [],
    featureDirectories: [],
    requiredSymlinks: [],
    deprecatedPrefixes: [],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedLinkCount, 1);
});

test('the repository audit rejects an existing deprecated documentation path', () => {
  const root = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs', 'planned'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'planned', 'proposal.md'), '# Proposal\n');
  execFileSync('git', ['add', '.'], { cwd: root });

  const result = runDocumentationAudit(root, {
    ownershipClasses: [{ name: 'current', include: ['docs/**'] }],
    linkCheckClasses: ['current'],
    barrelIndexes: [],
    documentIndexes: [],
    featureDirectories: [],
    requiredSymlinks: [],
    deprecatedPrefixes: ['docs/planned/'],
  });
  assert.deepEqual(result.errors, [
    'docs/planned/proposal.md: deprecated documentation location docs/planned/',
  ]);
});

test('the repository audit ignores tracked files deleted in the worktree', () => {
  const root = fixture();
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.writeFileSync(path.join(root, 'README.md'), '# Current\n');
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'old.md'), '# Old\n');
  execFileSync('git', ['add', 'README.md', 'docs/old.md'], { cwd: root });
  fs.rmSync(path.join(root, 'docs', 'old.md'));

  const result = runDocumentationAudit(root, {
    ownershipClasses: [{ name: 'current', include: ['README.md'] }],
    linkCheckClasses: ['current'],
    barrelIndexes: [],
    documentIndexes: [],
    featureDirectories: [],
    requiredSymlinks: [],
    deprecatedPrefixes: ['docs/'],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.documentCount, 1);
});
