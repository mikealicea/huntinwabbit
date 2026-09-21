#!/usr/bin/env bun
import { createProject } from "./lib";

const [, , ...args] = process.argv;

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Usage: bun create-project/index.ts <project-name> [--workspace <name>]\n" +
      "Example: bun create-project/index.ts my-new-project\n\n" +
      "--workspace overrides the parent index link. Without it the tool uses\n" +
      "the single *-projects.md at the workspace root, then the folder name.\n\n" +
      "See create-project.AGENTS.md in this package for full documentation.",
  );
  process.exit(0);
}

/**
 * Pull `--workspace <name>` / `--workspace=<name>` out of the positional args.
 * Reports the flag separately from its value so a valueless flag is an error
 * rather than a silent fall-through to the default.
 */
function takeWorkspaceFlag(argv: string[]): {
  present: boolean;
  value?: string | undefined;
} {
  const inline = argv.findIndex((a) => a.startsWith("--workspace="));
  if (inline !== -1) {
    const [flag] = argv.splice(inline, 1);
    return { present: true, value: flag?.slice("--workspace=".length) };
  }

  const named = argv.indexOf("--workspace");
  if (named !== -1) {
    const [, value] = argv.splice(named, 2);
    return { present: true, value };
  }

  return { present: false };
}

const { present: hasWorkspaceFlag, value: workspace } = takeWorkspaceFlag(args);

if (hasWorkspaceFlag && !workspace?.trim()) {
  console.error("--workspace requires a name, e.g. --workspace huntinwabbit");
  process.exit(1);
}

const name = args.join(" ").trim();

if (!name) {
  console.error(
    "Usage: bun create-project/index.ts <project-name>\n" +
      "Example: bun create-project/index.ts my-new-project",
  );
  process.exit(1);
}

try {
  const result = await createProject(name, process.cwd(), workspace);

  const { projectDir, indexFile, planFile } = result;
  const rel = (p: string) => p.slice(projectDir.length + 1);

  const subdirs = ["todo", "doing", "done", "resources"];
  const entries = [
    { label: rel(indexFile), isLast: false },
    { label: rel(planFile), isLast: false },
    ...subdirs.map((d, i) => ({
      label: `${d}/`,
      isLast: i === subdirs.length - 1,
    })),
  ];

  console.log(`✓ Project created: ${projectDir}/`);
  for (const { label, isLast } of entries) {
    console.log(`  ${isLast ? "└──" : "├──"} ${label}`);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
