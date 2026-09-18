import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listTools, type ToolEntry } from "./lib";

let packagesDir: string;

beforeEach(async () => {
  packagesDir = await mkdtemp(join(tmpdir(), "list-tools-test-"));
});

afterEach(async () => {
  await rm(packagesDir, { recursive: true, force: true });
});

async function makeToolPackage(
  name: string,
  json?: { name: string; description: string; exec: string },
): Promise<void> {
  const pkgDir = join(packagesDir, name);
  await mkdir(pkgDir, { recursive: true });
  if (json) {
    await writeFile(join(pkgDir, "TOOL.json"), JSON.stringify(json), "utf8");
  }
}

describe("listTools", () => {
  it("returns an empty array when no packages have TOOL.json", async () => {
    await makeToolPackage("some-tool"); // no TOOL.json
    const result = await listTools(packagesDir);
    expect(result).toEqual([]);
  });

  it("returns a single tool entry from a TOOL.json", async () => {
    await makeToolPackage("my-tool", {
      name: "my-tool",
      description: "Does something useful",
      exec: "bun index.ts",
    });

    const result = await listTools(packagesDir);
    expect(result).toHaveLength(1);

    const entry = result[0] as ToolEntry;
    expect(entry.name).toBe("my-tool");
    expect(entry.description).toBe("Does something useful");
    expect(entry.command).toContain("my-tool");
    expect(entry.command).toEndWith("index.ts");
  });

  it("returns multiple tools sorted alphabetically by name", async () => {
    await makeToolPackage("zebra-tool", {
      name: "zebra-tool",
      description: "Z tool",
      exec: "bun index.ts",
    });
    await makeToolPackage("alpha-tool", {
      name: "alpha-tool",
      description: "A tool",
      exec: "bun index.ts",
    });
    await makeToolPackage("middle-tool", {
      name: "middle-tool",
      description: "M tool",
      exec: "bun index.ts",
    });

    const result = await listTools(packagesDir);
    expect(result.map((t) => t.name)).toEqual([
      "alpha-tool",
      "middle-tool",
      "zebra-tool",
    ]);
  });

  it("skips packages that have no TOOL.json", async () => {
    await makeToolPackage("has-tool", {
      name: "has-tool",
      description: "Present",
      exec: "bun index.ts",
    });
    await makeToolPackage("no-tool-json"); // no TOOL.json

    const result = await listTools(packagesDir);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("has-tool");
  });

  it("command resolves to packages/<tool-dir>/index.ts", async () => {
    await makeToolPackage("some-tool", {
      name: "some-tool",
      description: "A tool",
      exec: "bun index.ts",
    });

    const result = await listTools(packagesDir);
    const entry = result[0] as ToolEntry;
    expect(entry.command).toBe(
      `bun ${join(packagesDir, "some-tool", "index.ts")}`,
    );
  });

  it("returns an empty array when the packages directory is empty", async () => {
    const result = await listTools(packagesDir);
    expect(result).toEqual([]);
  });
});
