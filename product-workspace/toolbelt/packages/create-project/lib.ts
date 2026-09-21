import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { indexTemplate, planTemplate } from "./templates";

export interface CreateProjectResult {
  projectDir: string;
  indexFile: string;
  planFile: string;
}

/** Convert a string to kebab-case, splitting on camelCase/PascalCase boundaries. */
export function toKebabCase(name: string): string {
  return (
    name
      .trim()
      // Insert a hyphen before sequences like "aB" (camelCase) or "ABc" (acronym followed by word)
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );
}

/** Return today's date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Normalise a workspace name into its projects-index note name. */
function toProjectsNote(name: string): string {
  const slug = toKebabCase(name);
  return slug.endsWith("-projects") ? slug : `${slug}-projects`;
}

/**
 * Find the workspace's projects index by looking for a single `*-projects.md`
 * at the workspace root. Returns `null` when there is no unambiguous match.
 */
async function discoverProjectsNote(cwd: string): Promise<string | null> {
  const entries = await readdir(cwd).catch(() => [] as string[]);
  const [only, ...rest] = entries.filter((e) => e.endsWith("-projects.md"));

  return only && rest.length === 0 ? only.slice(0, -".md".length) : null;
}

/**
 * Resolve the projects-index note that a new project links to as its parent.
 *
 * Deriving this from the folder name alone breaks whenever the workspace is
 * nested under a differently-named folder — as it is inside the huntinwabbit-boilerplate repo,
 * where the folder is `product-workspace` but the index is
 * `huntinwabbit-boilerplate-projects`. So prefer an explicit name, then the index actually
 * on disk, and only fall back to the folder name.
 */
async function workspaceProjectsNote(
  cwd: string,
  explicit?: string,
): Promise<string> {
  if (explicit?.trim()) {
    const note = toProjectsNote(explicit);

    if (note === "-projects") {
      throw new Error(`Could not derive workspace name from: ${explicit}`);
    }

    return note;
  }

  const discovered = await discoverProjectsNote(cwd);
  if (discovered) {
    return discovered;
  }

  const workspaceName = toKebabCase(basename(cwd));

  if (!workspaceName) {
    throw new Error(`Could not derive workspace name from: ${cwd}`);
  }

  return `${workspaceName}-projects`;
}

/**
 * Scaffold a new project directory inside `<cwd>/projects/`.
 *
 * @param name       The project name (kebab-cased automatically).
 * @param cwd        The workspace root — defaults to `process.cwd()`.
 * @param workspace  Workspace name for the parent index link. Defaults to the
 *                   `*-projects.md` found at `cwd`, then to the folder name.
 */
export async function createProject(
  name: string,
  cwd: string = process.cwd(),
  workspace?: string,
): Promise<CreateProjectResult> {
  const slug = toKebabCase(name);

  if (!slug) {
    throw new Error("Project name must not be empty.");
  }

  const date = today();
  const dirName = `${date}-${slug}`;
  const projectDir = join(cwd, "projects", dirName);

  // Fail fast if the directory already exists.
  const dirExists = await stat(projectDir).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (dirExists) {
    throw new Error(`Project directory already exists: ${projectDir}`);
  }

  // Create the project directory and subdirectories.
  for (const sub of ["", "todo", "doing", "done", "resources"]) {
    await mkdir(join(projectDir, sub), { recursive: true });
  }

  // Write the overview and plan files.
  const indexNoteName = `${dirName}.index`;
  const indexFile = join(projectDir, `${indexNoteName}.md`);
  const planFile = join(projectDir, `${dirName}.plan.md`);
  const workspaceParent = await workspaceProjectsNote(cwd, workspace);

  await writeFile(
    indexFile,
    indexTemplate(slug, workspaceParent, date),
    "utf8",
  );
  await writeFile(planFile, planTemplate(slug, indexNoteName, date), "utf8");

  return { projectDir, indexFile, planFile };
}
