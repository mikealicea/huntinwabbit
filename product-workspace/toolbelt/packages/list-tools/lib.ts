import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ToolEntry {
  name: string;
  description: string;
  command: string;
}

interface ToolJson {
  name: string;
  description: string;
  exec: string;
}

/** Resolve relative `.ts` filenames in an exec string to absolute paths. */
function resolveExec(exec: string, pkgDir: string): string {
  return exec
    .split(" ")
    .map((part) =>
      part.endsWith(".ts") && !part.startsWith("/") ? join(pkgDir, part) : part,
    )
    .join(" ");
}

/**
 * Scan `packagesDir` for subdirectories that contain a `TOOL.json` file,
 * parse each one, and return the sorted list of tool entries.
 */
export async function listTools(packagesDir: string): Promise<ToolEntry[]> {
  let entries: string[];
  try {
    entries = await readdir(packagesDir);
  } catch {
    return [];
  }

  const tools: ToolEntry[] = [];

  for (const entry of entries) {
    const toolJsonPath = join(packagesDir, entry, "TOOL.json");
    const file = Bun.file(toolJsonPath);

    if (!(await file.exists())) continue;

    let parsed: ToolJson;
    try {
      parsed = (await file.json()) as ToolJson;
    } catch {
      continue;
    }

    tools.push({
      name: parsed.name,
      description: parsed.description,
      command: resolveExec(parsed.exec, join(packagesDir, entry)),
    });
  }

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}
