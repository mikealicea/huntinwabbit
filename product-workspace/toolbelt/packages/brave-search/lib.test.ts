import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLlmContextBody,
  buildWebSearchUrl,
  parseCliArgs,
  parseDotEnv,
  resolveApiKey,
  runBraveSearch,
} from "./lib";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "brave-search-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("parseDotEnv", () => {
  it("parses simple key-value pairs", () => {
    expect(
      parseDotEnv("BRAVE_SEARCH_API_KEY=test-key\n# comment\nOTHER=value"),
    ).toEqual({
      BRAVE_SEARCH_API_KEY: "test-key",
      OTHER: "value",
    });
  });

  it("strips surrounding quotes", () => {
    expect(parseDotEnv('BRAVE_SEARCH_API_KEY="quoted-key"')).toEqual({
      BRAVE_SEARCH_API_KEY: "quoted-key",
    });
  });
});

describe("resolveApiKey", () => {
  it("reads BRAVE_SEARCH_API_KEY from toolbelt/.env", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "BRAVE_SEARCH_API_KEY=test-key\n",
      "utf8",
    );

    await expect(resolveApiKey(tempDir, {})).resolves.toBe("test-key");
  });

  it("prefers process env over toolbelt/.env", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "BRAVE_SEARCH_API_KEY=file-key\n",
      "utf8",
    );

    await expect(
      resolveApiKey(tempDir, { BRAVE_SEARCH_API_KEY: "env-key" }),
    ).resolves.toBe("env-key");
  });
});

describe("parseCliArgs", () => {
  it("parses web-search flags and query", () => {
    expect(
      parseCliArgs([
        "web-search",
        "--count",
        "5",
        "--country=US",
        "--search-lang",
        "en",
        "--offset",
        "0",
        "react",
        "hooks",
      ]),
    ).toEqual({
      mode: "web-search",
      query: "react hooks",
      count: 5,
      country: "US",
      searchLang: "en",
      offset: 0,
    });
  });

  it("parses llm-context flags and query", () => {
    expect(
      parseCliArgs([
        "llm-context",
        "--max-tokens",
        "2048",
        "--threshold",
        "strict",
        "--enable-local",
        "true",
        "react",
        "hooks",
      ]),
    ).toEqual({
      mode: "llm-context",
      query: "react hooks",
      maximumNumberOfTokens: 2048,
      contextThresholdMode: "strict",
      enableLocal: true,
    });
  });

  it("throws on unknown flags", () => {
    expect(() =>
      parseCliArgs(["web-search", "--unknown", "x", "query"]),
    ).toThrow(/Unknown flag/);
  });

  it("throws when the query is missing", () => {
    expect(() => parseCliArgs(["web-search", "--count", "5"])).toThrow(
      /search query is required/i,
    );
  });
});

describe("request builders", () => {
  it("forces extra_snippets=true for web-search", () => {
    const url = buildWebSearchUrl({
      mode: "web-search",
      query: "bun test",
      count: 5,
    });

    expect(url.searchParams.get("q")).toBe("bun test");
    expect(url.searchParams.get("count")).toBe("5");
    expect(url.searchParams.get("extra_snippets")).toBe("true");
  });

  it("builds llm-context POST bodies with snake_case keys", () => {
    expect(
      buildLlmContextBody({
        mode: "llm-context",
        query: "react hooks",
        count: 10,
        maximumNumberOfTokens: 2048,
        contextThresholdMode: "strict",
        enableLocal: true,
      }),
    ).toEqual({
      q: "react hooks",
      count: 10,
      maximum_number_of_tokens: 2048,
      context_threshold_mode: "strict",
      enable_local: true,
    });
  });
});

describe("runBraveSearch", () => {
  it("calls web-search with extra snippets and shapes the response", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "BRAVE_SEARCH_API_KEY=test-key\n",
      "utf8",
    );

    const requests: Request[] = [];
    const result = await runBraveSearch(
      {
        mode: "web-search",
        query: "react hooks",
        count: 5,
      },
      {
        toolbeltRoot: tempDir,
        env: {},
        fetchImpl: async (input, init) => {
          const request = new Request(input, init);
          requests.push(request);

          return new Response(
            JSON.stringify({
              query: {
                original: "react hooks",
                more_results_available: true,
              },
              web: {
                results: [
                  {
                    title: "React Hooks Guide",
                    url: "https://example.com/react-hooks",
                    description: "Main snippet",
                    extra_snippets: ["Extra one", "Extra two"],
                  },
                ],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        },
      },
    );

    expect(requests).toHaveLength(1);
    const firstRequest = requests[0];
    expect(firstRequest).toBeDefined();
    expect(firstRequest?.headers.get("X-Subscription-Token")).toBe("test-key");

    if (!firstRequest) {
      throw new Error("Expected a web-search request to be captured.");
    }

    const url = new URL(firstRequest.url);
    expect(url.pathname).toBe("/res/v1/web/search");
    expect(url.searchParams.get("extra_snippets")).toBe("true");

    expect(result).toEqual({
      mode: "web-search",
      query: "react hooks",
      moreResultsAvailable: true,
      results: [
        {
          title: "React Hooks Guide",
          url: "https://example.com/react-hooks",
          description: "Main snippet",
          extraSnippets: ["Extra one", "Extra two"],
        },
      ],
      locations: [],
    });
  });

  it("calls llm-context with POST and shapes sources + grounding", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "BRAVE_SEARCH_API_KEY=test-key\n",
      "utf8",
    );

    const requests: Request[] = [];
    const result = await runBraveSearch(
      {
        mode: "llm-context",
        query: "react hooks",
        count: 10,
        maximumNumberOfTokens: 2048,
        contextThresholdMode: "strict",
      },
      {
        toolbeltRoot: tempDir,
        env: {},
        fetchImpl: async (input, init) => {
          const request = new Request(input, init);
          requests.push(request);

          return new Response(
            JSON.stringify({
              grounding: {
                generic: [
                  {
                    url: "https://example.com/react-hooks",
                    title: "React Hooks Guide",
                    snippets: ["Use hooks for shared stateful logic."],
                  },
                ],
              },
              sources: {
                "https://example.com/react-hooks": {
                  title: "React Hooks Guide",
                  hostname: "example.com",
                  age: ["2025-01-01"],
                },
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        },
      },
    );

    expect(requests).toHaveLength(1);
    const firstRequest = requests[0];
    expect(firstRequest).toBeDefined();
    expect(firstRequest?.method).toBe("POST");
    expect(firstRequest?.url).toBe(
      "https://api.search.brave.com/res/v1/llm/context",
    );

    if (!firstRequest) {
      throw new Error("Expected an llm-context request to be captured.");
    }

    const body = JSON.parse(await firstRequest.text()) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      q: "react hooks",
      count: 10,
      maximum_number_of_tokens: 2048,
      context_threshold_mode: "strict",
    });

    expect(result).toEqual({
      mode: "llm-context",
      query: "react hooks",
      sources: [
        {
          url: "https://example.com/react-hooks",
          title: "React Hooks Guide",
          hostname: "example.com",
          age: ["2025-01-01"],
        },
      ],
      grounding: {
        generic: [
          {
            url: "https://example.com/react-hooks",
            title: "React Hooks Guide",
            snippets: ["Use hooks for shared stateful logic."],
          },
        ],
      },
    });
  });

  it("surfaces non-2xx API responses clearly", async () => {
    await writeFile(
      join(tempDir, ".env"),
      "BRAVE_SEARCH_API_KEY=test-key\n",
      "utf8",
    );

    await expect(
      runBraveSearch(
        {
          mode: "web-search",
          query: "react hooks",
        },
        {
          toolbeltRoot: tempDir,
          env: {},
          fetchImpl: async () =>
            new Response(JSON.stringify({ error: "bad token" }), {
              status: 401,
              statusText: "Unauthorized",
              headers: {
                "content-type": "application/json",
              },
            }),
        },
      ),
    ).rejects.toThrow(/401 Unauthorized/);
  });
});

describe("CLI usage", () => {
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

  it("prints usage and exits 0 with --help", async () => {
    const { stdout, stderr, exitCode } = await runCLI("--help");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("web-search");
    expect(stdout).toContain("llm-context");
  });

  it("prints usage and exits 1 when invoked without arguments", async () => {
    const { stdout, stderr, exitCode } = await runCLI();

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("Usage:");
  });
});
