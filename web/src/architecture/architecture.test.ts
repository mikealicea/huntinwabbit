import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from './architecture.check';

function checkFixture(files: Record<string, string>) {
  const root = mkdtempSync(
    path.join(tmpdir(), 'huntinwabbit-boilerplate-architecture-'),
  );
  try {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), text);
    }
    const program = ts.createProgram(
      Object.keys(files).map((name) => path.join(root, name)),
      {
        noLib: true,
        jsx: ts.JsxEmit.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
        paths: { '@/*': [path.join(root, '*')] },
      },
    );
    return checkArchitecture(program, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('presentation dependency boundaries', () => {
  it('allows props, local UI state, type imports, and pure named exports from mixed barrels', () => {
    expect(
      checkFixture({
        'Card.component.tsx': `import { useState as state } from 'react'; import Link from 'next/link'; import { label, type Data } from '@/feature.index'; export function Card() { const [open] = state(false); return <Link href="/">{label(open)}</Link>; }`,
        'feature.index.ts': `export { label } from './labels'; export { HiddenContainer } from './Hidden.container'; export type { Data } from './data';`,
        'labels.ts': `export const label = (open: boolean) => open ? 'Open' : 'Closed';`,
        'data.ts': `export interface Data { id: string }`,
        'Hidden.container.tsx': `export function HiddenContainer() { return <div />; }`,
      }),
    ).toEqual([]);
  });

  it.each([
    [
      'named alias',
      `import { Connected as Card } from '@/feature.index'; export const value = Card;`,
    ],
    [
      'namespace',
      `import * as feature from '@/feature.index'; export const value = feature.Connected;`,
    ],
    ['dynamic', `export const value = () => import('@/feature.index');`],
    ['require', `export const value = require('@/feature.index');`],
  ])('rejects a container concealed by a %s import', (_, code) => {
    expect(
      checkFixture({
        'View.component.tsx': code,
        'feature.index.ts': `export { HiddenContainer as Connected } from './Hidden.container';`,
        'Hidden.container.tsx': `export function HiddenContainer() { return <div />; }`,
      }),
    ).toEqual([
      expect.stringContaining('coordination module Hidden.container.tsx'),
    ]);
  });

  it('rejects external state hooks re-exported directly through barrels', () => {
    expect(
      checkFixture({
        'View.component.tsx': `import { read } from './public'; export const value = read;`,
        'public.ts': `export { useSelector as read } from 'react-redux';`,
      }),
    ).toEqual([expect.stringContaining('external adapter react-redux')]);
  });

  it('rejects server-only markers on intermediate named-export barrels', () => {
    expect(
      checkFixture({
        'View.component.tsx': `import { label } from './public'; export const value = label;`,
        'public.ts': `export { label } from './middle';`,
        'middle.ts': `import 'server-only'; export { label } from './label';`,
        'label.ts': `export const label = 'hello';`,
      }),
    ).toEqual([expect.stringContaining('server-only')]);
  });

  it('follows local hooks and multiple re-exports to Redux', () => {
    expect(
      checkFixture({
        'View.component.tsx': `import { useData } from './public'; export function View() { return <div>{useData()}</div>; }`,
        'public.ts': `export { useData } from './middle';`,
        'middle.ts': `export { useData } from './hook';`,
        'hook.ts': `import { useSelector } from 'react-redux'; export const useData = () => useSelector(() => 1);`,
      }),
    ).toEqual([expect.stringContaining('external adapter react-redux')]);
  });

  it.each([
    'next/navigation',
    'next-themes',
    '@dnd-kit/react',
    '@supabase/ssr',
    'server-only',
  ])('rejects the %s external boundary', (module) => {
    expect(
      checkFixture({
        'View.component.tsx': `import '${module}'; export function View() { return <div />; }`,
      }),
    ).toEqual([expect.stringContaining(`external adapter ${module}`)]);
  });

  it('rejects aliased action hooks and unresolved dynamic dependencies', () => {
    const errors = checkFixture({
      'View.component.tsx': `import { useActionState as action } from 'react'; export const view = () => { action(null, null); return import(location.hash); };`,
    });
    expect(errors).toEqual([
      expect.stringContaining('nonliteral dynamic dependency'),
      expect.stringContaining('named React UI'),
    ]);
  });

  it('detects server-only side effects in a barrel even for a pure re-export', () => {
    expect(
      checkFixture({
        'View.component.tsx': `import { label } from './public'; export const value = label;`,
        'public.ts': `import 'server-only'; export { label } from './label';`,
        'label.ts': `export const label = 'hello';`,
      }),
    ).toEqual([expect.stringContaining('server-only barrel')]);
  });

  it('checks JSX naming and container exports while preserving framework exceptions', () => {
    expect(
      checkFixture({
        'Plain.tsx': `export const Plain = () => <div />;`,
        'Wrong.container.tsx': `export function Wrong() { return <div />; }`,
        'app/page.tsx': `export default function Page() { return <div />; }`,
      }),
    ).toEqual([
      expect.stringContaining('JSX owner'),
      expect.stringContaining('end in Container'),
    ]);
  });
});

it('keeps the application within its architecture boundaries', () => {
  const configPath = path.resolve('tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  expect(checkArchitecture(program, path.resolve('src'))).toEqual([]);
}, 20_000);
