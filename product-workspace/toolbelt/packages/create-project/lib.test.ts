import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createProject, toKebabCase } from "./lib";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "toolbelt-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("toKebabCase", () => {
  it("lowercases a simple name", () => {
    expect(toKebabCase("MyProject")).toBe("my-project");
  });

  it("replaces spaces with hyphens", () => {
    expect(toKebabCase("my project")).toBe("my-project");
  });

  it("collapses multiple spaces/hyphens", () => {
    expect(toKebabCase("my  project--name")).toBe("my-project-name");
  });

  it("strips leading/trailing whitespace", () => {
    expect(toKebabCase("  my project  ")).toBe("my-project");
  });

  it("handles already-kebab-case input", () => {
    expect(toKebabCase("my-project")).toBe("my-project");
  });
});

describe("createProject", () => {
  it("creates the project directory with a YYYY-MM-DD prefix", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("my-project", tempDir);

    expect(result.projectDir).toBe(
      join(tempDir, "projects", `${today}-my-project`),
    );

    // directory existence: use fs
    const { stat: fsStat } = await import("node:fs/promises");
    const dirStat = await fsStat(result.projectDir);
    expect(dirStat.isDirectory()).toBe(true);
  });

  it("creates the overview .md file with correct frontmatter", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("my-project", tempDir);
    const content = await Bun.file(result.indexFile).text();
    const workspaceProjectsNote = `${toKebabCase(basename(tempDir))}-projects`;

    expect(content).toContain(`parent:\n  - "[[${workspaceProjectsNote}]]"`);
    expect(content).toContain(`date: ${today}`);
  });

  it("creates the plan .plan.md file with correct frontmatter", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("my-project", tempDir);
    const content = await Bun.file(result.planFile).text();

    expect(content).toContain(`parent:\n  - "[[${today}-my-project.index]]"`);
    expect(content).toContain(`date: ${today}`);
  });

  it("index file is named <date>-<project-name>.index.md", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("my-project", tempDir);
    expect(result.indexFile).toEndWith(`${today}-my-project.index.md`);
  });

  it("plan file is named <date>-<project-name>.plan.md", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("my-project", tempDir);
    expect(result.planFile).toEndWith(`${today}-my-project.plan.md`);
  });

  it("creates todo/, doing/, done/, resources/ subdirectories", async () => {
    const { stat } = await import("node:fs/promises");
    const result = await createProject("my-project", tempDir);

    for (const sub of ["todo", "doing", "done", "resources"]) {
      const dirStat = await stat(join(result.projectDir, sub));
      expect(dirStat.isDirectory()).toBe(true);
    }
  });

  it("converts a name with spaces to kebab-case for the folder", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createProject("My New Project", tempDir);

    expect(result.projectDir).toEndWith(`${today}-my-new-project`);
  });

  it("throws if the project directory already exists", async () => {
    await createProject("my-project", tempDir);
    await expect(createProject("my-project", tempDir)).rejects.toThrow(
      /already exists/,
    );
  });

  it("throws if the project name is empty", async () => {
    await expect(createProject("", tempDir)).rejects.toThrow(/project name/i);
  });

  it("throws if the project name is only whitespace", async () => {
    await expect(createProject("   ", tempDir)).rejects.toThrow(
      /project name/i,
    );
  });
});

describe("createProject workspace parent", () => {
  it("uses the *-projects.md at the workspace root over the folder name", async () => {
    await Bun.write(
      join(tempDir, "huntinwabbit-boilerplate-projects.md"),
      "# projects\n",
    );
    const result = await createProject("my-project", tempDir);
    const content = await Bun.file(result.indexFile).text();

    expect(content).toContain(
      `parent:\n  - "[[huntinwabbit-boilerplate-projects]]"`,
    );
    expect(content).not.toContain(toKebabCase(basename(tempDir)));
  });

  it("prefers an explicit workspace name over the index on disk", async () => {
    await Bun.write(
      join(tempDir, "huntinwabbit-boilerplate-projects.md"),
      "# projects\n",
    );
    const result = await createProject("my-project", tempDir, "other-vault");
    const content = await Bun.file(result.indexFile).text();

    expect(content).toContain(`parent:\n  - "[[other-vault-projects]]"`);
  });

  it("accepts an explicit name that already ends in -projects", async () => {
    const result = await createProject(
      "my-project",
      tempDir,
      "huntinwabbit-boilerplate-projects",
    );
    const content = await Bun.file(result.indexFile).text();

    expect(content).toContain(
      `parent:\n  - "[[huntinwabbit-boilerplate-projects]]"`,
    );
  });

  it("falls back to the folder name when the root index is ambiguous", async () => {
    await Bun.write(join(tempDir, "one-projects.md"), "# one\n");
    await Bun.write(join(tempDir, "two-projects.md"), "# two\n");
    const result = await createProject("my-project", tempDir);
    const content = await Bun.file(result.indexFile).text();
    const fromFolder = `${toKebabCase(basename(tempDir))}-projects`;

    expect(content).toContain(`parent:\n  - "[[${fromFolder}]]"`);
  });

  it("ignores a *-projects.md nested below the workspace root", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(tempDir, "nested"), { recursive: true });
    await Bun.write(
      join(tempDir, "nested", "huntinwabbit-boilerplate-projects.md"),
      "# projects\n",
    );
    const result = await createProject("my-project", tempDir);
    const content = await Bun.file(result.indexFile).text();
    const fromFolder = `${toKebabCase(basename(tempDir))}-projects`;

    expect(content).toContain(`parent:\n  - "[[${fromFolder}]]"`);
  });

  it("throws on an explicit workspace name with no usable characters", async () => {
    await expect(createProject("my-project", tempDir, "!!!")).rejects.toThrow(
      /workspace name/i,
    );
  });
});

describe("CLI --help / -h flags", () => {
  const cli = join(import.meta.dir, "index.ts");

  async function runCLI(...args: string[]) {
    const proc = Bun.spawn(["bun", cli, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }

  it("exits 0 with --help", async () => {
    const { exitCode } = await runCLI("--help");
    expect(exitCode).toBe(0);
  });

  it("exits 0 with -h", async () => {
    const { exitCode } = await runCLI("-h");
    expect(exitCode).toBe(0);
  });

  it("prints usage to stdout with --help", async () => {
    const { stdout } = await runCLI("--help");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("<project-name>");
  });

  it("prints usage to stdout with -h", async () => {
    const { stdout } = await runCLI("-h");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("<project-name>");
  });

  it("does not create any files or directories with --help", async () => {
    const { readdir } = await import("node:fs/promises");
    await runCLI("--help");
    const entries = await readdir(tempDir);
    expect(entries).toHaveLength(0);
  });
});

describe("CLI --workspace flag", () => {
  const cli = join(import.meta.dir, "index.ts");

  async function runInWorkspace(...args: string[]) {
    const proc = Bun.spawn(["bun", cli, ...args], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }

  it("does not treat the flag value as part of the project name", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { exitCode, stdout } = await runInWorkspace(
      "my project",
      "--workspace",
      "huntinwabbit-boilerplate",
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain(`${today}-my-project.index.md`);

    const index = await Bun.file(
      join(
        tempDir,
        "projects",
        `${today}-my-project`,
        `${today}-my-project.index.md`,
      ),
    ).text();
    expect(index).toContain(
      `parent:\n  - "[[huntinwabbit-boilerplate-projects]]"`,
    );
  });

  it("accepts --workspace=<name>", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { exitCode } = await runInWorkspace(
      "my project",
      "--workspace=huntinwabbit-boilerplate",
    );

    expect(exitCode).toBe(0);

    const index = await Bun.file(
      join(
        tempDir,
        "projects",
        `${today}-my-project`,
        `${today}-my-project.index.md`,
      ),
    ).text();
    expect(index).toContain(
      `parent:\n  - "[[huntinwabbit-boilerplate-projects]]"`,
    );
  });

  it("exits 1 when --workspace has no value", async () => {
    const { exitCode, stderr } = await runInWorkspace(
      "my project",
      "--workspace",
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain("--workspace");
  });
});

describe("CLI output", () => {
  const cli = join(import.meta.dir, "index.ts");

  it("prints the index and plan filenames in the scaffold tree", async () => {
    const workspaceDir = await mkdtemp(join(tempDir, "agentic-personal-"));
    const proc = Bun.spawn(["bun", cli, "my project"], {
      cwd: workspaceDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const today = new Date().toISOString().slice(0, 10);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(`${today}-my-project.index.md`);
    expect(stdout).toContain(`${today}-my-project.plan.md`);
  });
});
