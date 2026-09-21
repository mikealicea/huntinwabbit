import path from 'node:path';
import ts from 'typescript';

const reactUI = new Set([
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useRef',
  'useId',
  'useMemo',
  'useCallback',
  'memo',
  'forwardRef',
  'Fragment',
  'createElement',
]);
const frameworkUI = new Set(['next/link', 'next/image']);
const coordinationFile =
  /\.(?:container|provider|adapter|slice|store|actions|operations|session|proxy|client|server)(?:\.index)?\.[jt]sx?$/;

/** Import guard, not a purity proof. Follow named barrel exports to their executable owners. */
export function checkArchitecture(
  program: ts.Program,
  sourceRoot: string,
): string[] {
  const checker = program.getTypeChecker();
  const violations = new Set<string>();
  const relative = (file: string) =>
    path.relative(sourceRoot, file).replaceAll(path.sep, '/');
  const local = (file: ts.SourceFile) =>
    !file.isDeclarationFile && !relative(file.fileName).startsWith('..');
  const sourceFiles = program
    .getSourceFiles()
    .filter((file) => local(file) && !/\.test\.[jt]sx?$/.test(file.fileName));
  const report = (origin: ts.SourceFile, reason: string) =>
    violations.add(`${relative(origin.fileName)}: ${reason}`);

  function isCoordination(file: ts.SourceFile) {
    return (
      coordinationFile.test(file.fileName) ||
      relative(file.fileName).startsWith('state/')
    );
  }

  function followSymbol(
    symbol: ts.Symbol | undefined,
    origin: ts.SourceFile,
    visited: Set<string>,
  ) {
    const aliases = new Set<ts.Symbol>();
    let target = symbol;
    // Follow each alias hop: jumping straight to its final declaration would miss
    // an external re-export or server-only marker on an intermediate barrel.
    while (
      target &&
      target.flags & ts.SymbolFlags.Alias &&
      !aliases.has(target)
    ) {
      aliases.add(target);
      for (const declaration of target.declarations ?? []) {
        const owner = declaration.getSourceFile();
        if (!local(owner)) continue;
        if (isCoordination(owner)) {
          visit(owner, origin, visited);
          return;
        }
        for (const statement of owner.statements) {
          if (
            ts.isImportDeclaration(statement) &&
            !statement.importClause &&
            ts.isStringLiteral(statement.moduleSpecifier)
          ) {
            if (statement.moduleSpecifier.text === 'server-only')
              report(
                origin,
                `presentation reaches server-only barrel ${relative(owner.fileName)}`,
              );
            else visit(owner, origin, visited);
          }
        }
        let statement: ts.Node = declaration;
        while (
          statement.parent &&
          !ts.isImportDeclaration(statement) &&
          !ts.isExportDeclaration(statement)
        )
          statement = statement.parent;
        if (
          (ts.isImportDeclaration(statement) ||
            ts.isExportDeclaration(statement)) &&
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          const specifier = statement.moduleSpecifier.text;
          if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
            if (specifier === 'react') {
              const name =
                ts.isImportSpecifier(declaration) ||
                ts.isExportSpecifier(declaration)
                  ? (declaration.propertyName ?? declaration.name).text
                  : '';
              if (!reactUI.has(name))
                report(
                  origin,
                  'presentation may import only named React UI hooks/helpers',
                );
            } else if (!frameworkUI.has(specifier))
              report(
                origin,
                `presentation reaches external adapter ${specifier}`,
              );
          }
        }
      }
      target = checker.getImmediateAliasedSymbol(target);
    }
    if (!target || !(target.flags & ts.SymbolFlags.Value)) return;
    for (const declaration of target.declarations ?? []) {
      const owner = declaration.getSourceFile();
      if (local(owner)) visit(owner, origin, visited);
    }
  }

  function visit(
    file: ts.SourceFile,
    origin: ts.SourceFile,
    visited: Set<string>,
  ) {
    if (visited.has(file.fileName)) return;
    visited.add(file.fileName);
    if (isCoordination(file)) {
      report(
        origin,
        `presentation reaches coordination module ${relative(file.fileName)}`,
      );
      return;
    }
    function dependency(
      module: ts.StringLiteralLike,
      names: readonly ts.ModuleExportName[] | null,
    ) {
      const specifier = module.text;
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
        if (specifier === 'react') {
          if (!names || names.some((name) => !reactUI.has(name.text))) {
            report(
              origin,
              'presentation may import only named React UI hooks/helpers',
            );
          }
        } else if (!frameworkUI.has(specifier)) {
          report(origin, `presentation reaches external adapter ${specifier}`);
        }
        return;
      }
      let moduleSymbol = checker.getSymbolAtLocation(module);
      if (!moduleSymbol) {
        const resolved = ts.resolveModuleName(
          specifier,
          file.fileName,
          program.getCompilerOptions(),
          ts.sys,
        ).resolvedModule;
        const resolvedFile =
          resolved && program.getSourceFile(resolved.resolvedFileName);
        if (resolvedFile)
          moduleSymbol = checker.getSymbolAtLocation(resolvedFile);
      }
      const moduleFile = moduleSymbol?.declarations?.find(ts.isSourceFile);
      if (!moduleFile || !moduleSymbol) {
        report(origin, `cannot resolve runtime dependency ${specifier}`);
        return;
      }
      if (isCoordination(moduleFile)) {
        visit(moduleFile, origin, visited);
        return;
      }
      // A barrel can have a server-only marker or side effects independently of its exports.
      for (const statement of moduleFile.statements) {
        if (
          ts.isImportDeclaration(statement) &&
          !statement.importClause &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          if (statement.moduleSpecifier.text === 'server-only')
            report(
              origin,
              `presentation reaches server-only barrel ${relative(moduleFile.fileName)}`,
            );
          else visit(moduleFile, origin, visited);
        }
      }
      if (names) {
        for (const name of names)
          followSymbol(checker.getSymbolAtLocation(name), origin, visited);
      } else {
        visit(moduleFile, origin, visited);
        for (const symbol of checker.getExportsOfModule(moduleSymbol))
          followSymbol(symbol, origin, visited);
      }
    }
    function walk(node: ts.Node) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) return;
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          const values = bindings.elements.filter(
            (element) => !element.isTypeOnly,
          );
          if (!clause?.name && values.length === 0) return;
          // Property names preserve the original React API even when locally aliased.
          const names = values.map((element) =>
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text === 'react'
              ? (element.propertyName ?? element.name)
              : element.name,
          );
          if (clause?.name) names.push(clause.name);
          dependency(node.moduleSpecifier, names);
        } else {
          dependency(
            node.moduleSpecifier,
            clause?.name && !bindings ? [clause.name] : null,
          );
        }
        return;
      }
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !node.isTypeOnly
      ) {
        const names =
          node.exportClause && ts.isNamedExports(node.exportClause)
            ? node.exportClause.elements
                .filter((item) => !item.isTypeOnly)
                .map((item) => item.name)
            : null;
        if (!names || names.length) dependency(node.moduleSpecifier, names);
        return;
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument))
          dependency(argument, null);
        else report(origin, 'presentation has a nonliteral dynamic dependency');
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ['fetch', 'useActionState', 'useSyncExternalStore'].includes(
          node.expression.text,
        )
      ) {
        report(
          origin,
          `presentation calls coordination API ${node.expression.text}`,
        );
      }
      ts.forEachChild(node, walk);
    }
    walk(file);
  }

  for (const file of sourceFiles) {
    const name = relative(file.fileName);
    if (name.startsWith('architecture/')) continue;
    let jsx = false;
    function findJSX(node: ts.Node) {
      if (
        ts.isJsxElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxFragment(node)
      )
        jsx = true;
      ts.forEachChild(node, findJSX);
    }
    findJSX(file);
    const frameworkFile =
      name.startsWith('app/') ||
      name === 'features/blog/blog.mdx-components.tsx';
    if (
      jsx &&
      !frameworkFile &&
      !/\.(component|container|provider|adapter)\.tsx$/.test(name)
    ) {
      report(
        file,
        'JSX owner needs a component, container, provider, or adapter suffix',
      );
    }
    if (name.endsWith('.container.tsx')) {
      for (const statement of file.statements) {
        if (
          ts.isFunctionDeclaration(statement) &&
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          ) &&
          !statement.name?.text.endsWith('Container')
        ) {
          report(file, 'exported container functions must end in Container');
        }
      }
    }
    if (name.endsWith('.component.tsx')) visit(file, file, new Set());
  }
  return [...violations].sort();
}
