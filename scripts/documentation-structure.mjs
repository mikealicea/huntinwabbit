import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.txt']);

export function globToRegExp(glob) {
  let source = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[\\^$+?.()|{}\[\]]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function matchesAny(file, patterns = []) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

export function classifyFile(file, classes) {
  return classes
    .filter(({ include, exclude = [] }) => matchesAny(file, include) && !matchesAny(file, exclude))
    .map(({ name }) => name);
}

function trackedFiles(repositoryRoot) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repositoryRoot },
  );
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => fs.existsSync(path.join(repositoryRoot, file)));
}

function githubSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function headingSlugs(text) {
  const seen = new Map();
  const slugs = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = githubSlug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function markdownDestinations(text) {
  const destinations = [];
  const pattern = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+['"][^)]*['"])?\)/g;
  for (const match of text.matchAll(pattern)) {
    destinations.push(match[1].replace(/^<|>$/g, ''));
  }
  return destinations;
}

function wikiDestinations(text) {
  const destinations = [];
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  for (const match of text.matchAll(pattern)) destinations.push(match[1].trim());
  return destinations;
}

function decodeDestination(destination) {
  try {
    return decodeURIComponent(destination);
  } catch {
    return destination;
  }
}

export function validateRelativeLinks({ repositoryRoot, files }) {
  const errors = [];
  for (const file of files) {
    const absoluteFile = path.join(repositoryRoot, file);
    if (!fs.existsSync(absoluteFile) || fs.lstatSync(absoluteFile).isSymbolicLink()) continue;
    const text = fs.readFileSync(absoluteFile, 'utf8');
    for (const rawDestination of markdownDestinations(text)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(rawDestination)) continue;
      const [rawPath, fragment] = rawDestination.split('#', 2);
      const decodedPath = decodeDestination(rawPath);
      const resolved = path.resolve(path.dirname(absoluteFile), decodedPath || '.');
      const relative = path.relative(repositoryRoot, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        errors.push(`${file}: link escapes the repository: ${rawDestination}`);
        continue;
      }
      if (!fs.existsSync(resolved)) {
        errors.push(`${file}: missing link target: ${rawDestination}`);
        continue;
      }
      const realRepositoryRoot = fs.realpathSync(repositoryRoot);
      const realTarget = fs.realpathSync(resolved);
      const realRelative = path.relative(realRepositoryRoot, realTarget);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        errors.push(`${file}: link escapes the repository: ${rawDestination}`);
        continue;
      }
      if (fragment && fs.statSync(resolved).isFile() && path.extname(resolved) === '.md') {
        const targetText = fs.readFileSync(resolved, 'utf8');
        if (!headingSlugs(targetText).has(decodeDestination(fragment).toLowerCase())) {
          errors.push(`${file}: missing heading in ${rawDestination}`);
        }
      }
    }
  }
  return errors;
}

export function validateBarrelCoverage({ repositoryRoot, files, barrelIndexes }) {
  const errors = [];
  for (const { guide, include } of barrelIndexes) {
    const guidePath = path.join(repositoryRoot, guide);
    if (!fs.existsSync(guidePath)) {
      errors.push(`missing project guide: ${guide}`);
      continue;
    }
    const guideText = fs.readFileSync(guidePath, 'utf8');
    const barrels = files.filter((file) => matchesAny(file, include));
    for (const barrel of barrels) {
      const fromGuide = path.relative(path.dirname(guide), barrel).split(path.sep).join('/');
      if (!guideText.includes(fromGuide) && !guideText.includes(barrel)) {
        errors.push(`${guide}: does not mention barrel ${barrel}`);
      }
    }
  }
  return errors;
}

export function validateIndexCoverage({ repositoryRoot, files, documentIndexes = [] }) {
  const errors = [];
  for (const { index, include, exclude = [], allowBasename = false } of documentIndexes) {
    const indexPath = path.join(repositoryRoot, index);
    if (!fs.existsSync(indexPath)) {
      errors.push(`missing documentation index: ${index}`);
      continue;
    }
    const indexText = fs.readFileSync(indexPath, 'utf8');
    const explicitReferences = new Set([
      ...markdownDestinations(indexText).map((destination) => (
        decodeDestination(destination.split('#', 1)[0]).replace(/^<|>$/g, '')
      )),
      ...wikiDestinations(indexText),
    ]);
    const indexedFiles = files.filter(
      (file) => matchesAny(file, include) && !matchesAny(file, exclude) && file !== index,
    );
    for (const indexedFile of indexedFiles) {
      const relative = path.relative(path.dirname(index), indexedFile).split(path.sep).join('/');
      const references = [relative, indexedFile];
      if (allowBasename) {
        const basename = path.basename(indexedFile);
        references.push(basename, basename.slice(0, -path.extname(basename).length));
      }
      if (!references.some((reference) => explicitReferences.has(reference))) {
        errors.push(`${index}: does not mention indexed document ${indexedFile}`);
      }
    }
  }
  return errors;
}

export function validateFeatureDirectories({ files, featureDirectories }) {
  const errors = [];
  for (const featureRoot of featureDirectories) {
    const prefix = `${featureRoot}/`;
    const featureNames = new Set(
      files
        .filter((file) => file.startsWith(prefix))
        .map((file) => file.slice(prefix.length).split('/')[0])
        .filter(Boolean),
    );
    for (const featureName of [...featureNames].sort()) {
      const featurePrefix = `${prefix}${featureName}/`;
      const barrel = files.some((file) => (
        file.startsWith(featurePrefix)
        && !file.slice(featurePrefix.length).includes('/')
        && file.endsWith('.AGENTS.md')
      ));
      if (!barrel) {
        errors.push(`${featureRoot}/${featureName}: feature directory has no direct barrel`);
      }
    }
  }
  return errors;
}

export function validateSymlinks({ repositoryRoot, requiredSymlinks }) {
  const errors = [];
  for (const requirement of requiredSymlinks) {
    const absolutePath = path.join(repositoryRoot, requirement.path);
    let stats;
    try {
      stats = fs.lstatSync(absolutePath);
    } catch {
      stats = undefined;
    }
    if (!stats?.isSymbolicLink()) {
      errors.push(`${requirement.path}: required documentation symlink is missing`);
      continue;
    }
    if (fs.readlinkSync(absolutePath) !== requirement.target) {
      errors.push(`${requirement.path}: expected target ${requirement.target}`);
    }
  }
  return errors;
}

export function runDocumentationAudit(repositoryRoot, policy) {
  const files = trackedFiles(repositoryRoot);
  const documents = files.filter((file) => DOCUMENT_EXTENSIONS.has(path.extname(file)))
    .filter((file) => {
      const absolute = path.join(repositoryRoot, file);
      return !fs.existsSync(absolute) || !fs.lstatSync(absolute).isSymbolicLink();
    });
  const errors = [];

  const classifications = new Map();
  for (const file of documents) {
    const classes = classifyFile(file, policy.ownershipClasses);
    classifications.set(file, classes);
    if (classes.length !== 1) {
      errors.push(`${file}: expected one documentation owner, found ${classes.join(', ') || 'none'}`);
    }
  }

  const linkFiles = documents.filter((file) => {
    const classes = classifications.get(file) ?? [];
    return classes.length === 1 && policy.linkCheckClasses.includes(classes[0]);
  });
  errors.push(...validateRelativeLinks({ repositoryRoot, files: linkFiles }));
  errors.push(...validateBarrelCoverage({
    repositoryRoot,
    files,
    barrelIndexes: policy.barrelIndexes,
  }));
  errors.push(...validateIndexCoverage({
    repositoryRoot,
    files,
    documentIndexes: policy.documentIndexes,
  }));
  errors.push(...validateFeatureDirectories({
    files,
    featureDirectories: policy.featureDirectories,
  }));
  errors.push(...validateSymlinks({
    repositoryRoot,
    requiredSymlinks: policy.requiredSymlinks,
  }));

  for (const prefix of policy.deprecatedPrefixes) {
    for (const file of files.filter((candidate) => candidate.startsWith(prefix))) {
      errors.push(`${file}: deprecated documentation location ${prefix}`);
    }
  }

  return {
    documentCount: documents.length,
    checkedLinkCount: linkFiles.length,
    errors: errors.sort(),
  };
}
