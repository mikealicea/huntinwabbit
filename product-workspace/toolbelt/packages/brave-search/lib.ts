import { readFile } from "node:fs/promises";
import { join } from "node:path";

const WEB_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const LLM_CONTEXT_ENDPOINT = "https://api.search.brave.com/res/v1/llm/context";
const DEFAULT_TIMEOUT_MS = 30_000;

export type SearchMode = "web-search" | "llm-context";
type SafeSearchMode = "off" | "moderate" | "strict";
type ThresholdMode = "strict" | "balanced" | "lenient" | "disabled";

export interface WebSearchCommand {
  mode: "web-search";
  query: string;
  count?: number;
  country?: string;
  searchLang?: string;
  freshness?: string;
  offset?: number;
  safeSearch?: SafeSearchMode;
}

export interface LlmContextCommand {
  mode: "llm-context";
  query: string;
  count?: number;
  country?: string;
  searchLang?: string;
  freshness?: string;
  maximumNumberOfUrls?: number;
  maximumNumberOfTokens?: number;
  maximumNumberOfSnippets?: number;
  maximumNumberOfTokensPerUrl?: number;
  maximumNumberOfSnippetsPerUrl?: number;
  contextThresholdMode?: ThresholdMode;
  enableLocal?: boolean;
}

export type SearchCommand = WebSearchCommand | LlmContextCommand;

export interface WebSearchResult {
  title: string;
  url: string;
  description?: string;
  extraSnippets: string[];
}

export interface WebSearchLocation {
  id?: string;
  title: string;
  url?: string;
  description?: string;
}

export interface WebSearchOutput {
  mode: "web-search";
  query: string;
  moreResultsAvailable: boolean;
  results: WebSearchResult[];
  locations: WebSearchLocation[];
}

export interface LlmContextSource {
  url: string;
  title?: string;
  hostname?: string;
  age?: string[] | null;
}

export interface LlmContextOutput {
  mode: "llm-context";
  query: string;
  sources: LlmContextSource[];
  grounding: Record<string, unknown>;
}

export interface RunBraveSearchDeps {
  fetchImpl?: typeof fetch;
  toolbeltRoot?: string;
  env?: Record<string, string | undefined>;
}

interface WebSearchApiResult {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
}

interface WebSearchApiLocation {
  id?: string;
  title?: string;
  url?: string;
  description?: string;
}

interface WebSearchApiResponse {
  query?: {
    original?: string;
    more_results_available?: boolean;
  };
  web?: {
    results?: WebSearchApiResult[];
  };
  locations?: {
    results?: WebSearchApiLocation[];
  };
}

interface LlmContextSourceMetadata {
  title?: string;
  hostname?: string;
  age?: string[] | null;
}

interface LlmContextApiResponse {
  grounding?: Record<string, unknown>;
  sources?: Record<string, LlmContextSourceMetadata>;
}

function defaultToolbeltRoot(): string {
  return join(import.meta.dir, "..", "..");
}

export function shouldShowHelp(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function parseInteger(flag: string, value: string, minimum: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${flag} must be an integer >= ${minimum}.`);
  }

  return parsed;
}

function parseBoolean(flag: string, value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${flag} must be either true or false.`);
}

function readFlagValue(
  args: string[],
  index: number,
  inlineValue?: string,
): { value: string; nextIndex: number } {
  if (inlineValue !== undefined) {
    return { value: inlineValue, nextIndex: index };
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${args[index]}.`);
  }

  return { value, nextIndex: index + 1 };
}

function splitFlag(token: string): { flag: string; inlineValue?: string } {
  const equalIndex = token.indexOf("=");
  if (equalIndex === -1) {
    return { flag: token };
  }

  return {
    flag: token.slice(0, equalIndex),
    inlineValue: token.slice(equalIndex + 1),
  };
}

export function parseCliArgs(args: string[]): SearchCommand {
  const [mode, ...rest] = args;

  if (mode !== "web-search" && mode !== "llm-context") {
    throw new Error("First argument must be either web-search or llm-context.");
  }

  const queryParts: string[] = [];
  const common: {
    count?: number;
    country?: string;
    searchLang?: string;
    freshness?: string;
  } = {};
  const webOnly: {
    offset?: number;
    safeSearch?: SafeSearchMode;
  } = {};
  const llmOnly: {
    maximumNumberOfUrls?: number;
    maximumNumberOfTokens?: number;
    maximumNumberOfSnippets?: number;
    maximumNumberOfTokensPerUrl?: number;
    maximumNumberOfSnippetsPerUrl?: number;
    contextThresholdMode?: ThresholdMode;
    enableLocal?: boolean;
  } = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];

    if (token.startsWith("--")) {
      const { flag, inlineValue } = splitFlag(token);
      const { value, nextIndex } = readFlagValue(rest, i, inlineValue);
      i = nextIndex;

      switch (flag) {
        case "--count":
          common.count = parseInteger(flag, value, 1);
          break;
        case "--country":
          common.country = value;
          break;
        case "--search-lang":
          common.searchLang = value;
          break;
        case "--freshness":
          common.freshness = value;
          break;
        case "--offset":
          if (mode !== "web-search") {
            throw new Error("--offset is only supported for web-search.");
          }
          webOnly.offset = parseInteger(flag, value, 0);
          break;
        case "--safesearch":
          if (mode !== "web-search") {
            throw new Error("--safesearch is only supported for web-search.");
          }
          if (value !== "off" && value !== "moderate" && value !== "strict") {
            throw new Error("--safesearch must be off, moderate, or strict.");
          }
          webOnly.safeSearch = value;
          break;
        case "--max-urls":
          if (mode !== "llm-context") {
            throw new Error("--max-urls is only supported for llm-context.");
          }
          llmOnly.maximumNumberOfUrls = parseInteger(flag, value, 1);
          break;
        case "--max-tokens":
          if (mode !== "llm-context") {
            throw new Error("--max-tokens is only supported for llm-context.");
          }
          llmOnly.maximumNumberOfTokens = parseInteger(flag, value, 1);
          break;
        case "--max-snippets":
          if (mode !== "llm-context") {
            throw new Error(
              "--max-snippets is only supported for llm-context.",
            );
          }
          llmOnly.maximumNumberOfSnippets = parseInteger(flag, value, 1);
          break;
        case "--max-tokens-per-url":
          if (mode !== "llm-context") {
            throw new Error(
              "--max-tokens-per-url is only supported for llm-context.",
            );
          }
          llmOnly.maximumNumberOfTokensPerUrl = parseInteger(flag, value, 1);
          break;
        case "--max-snippets-per-url":
          if (mode !== "llm-context") {
            throw new Error(
              "--max-snippets-per-url is only supported for llm-context.",
            );
          }
          llmOnly.maximumNumberOfSnippetsPerUrl = parseInteger(flag, value, 1);
          break;
        case "--threshold":
          if (mode !== "llm-context") {
            throw new Error("--threshold is only supported for llm-context.");
          }
          if (
            value !== "strict" &&
            value !== "balanced" &&
            value !== "lenient" &&
            value !== "disabled"
          ) {
            throw new Error(
              "--threshold must be strict, balanced, lenient, or disabled.",
            );
          }
          llmOnly.contextThresholdMode = value;
          break;
        case "--enable-local":
          if (mode !== "llm-context") {
            throw new Error(
              "--enable-local is only supported for llm-context.",
            );
          }
          llmOnly.enableLocal = parseBoolean(flag, value);
          break;
        default:
          throw new Error(`Unknown flag: ${flag}`);
      }

      continue;
    }

    queryParts.push(token);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    throw new Error("A search query is required.");
  }

  if (mode === "web-search") {
    return {
      mode,
      query,
      ...common,
      ...webOnly,
    };
  }

  return {
    mode,
    query,
    ...common,
    ...llmOnly,
  };
}

export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

export async function resolveApiKey(
  toolbeltRoot: string = defaultToolbeltRoot(),
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const direct = env.BRAVE_SEARCH_API_KEY?.trim();
  if (direct) {
    return direct;
  }

  const envPath = join(toolbeltRoot, ".env");

  let fileContent = "";
  try {
    fileContent = await readFile(envPath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `Missing BRAVE_SEARCH_API_KEY. Add it to ${envPath} or export BRAVE_SEARCH_API_KEY in your environment.`,
      );
    }

    throw error;
  }

  const parsed = parseDotEnv(fileContent);
  const apiKey = parsed.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `Missing BRAVE_SEARCH_API_KEY. Add it to ${envPath} or export BRAVE_SEARCH_API_KEY in your environment.`,
    );
  }

  return apiKey;
}

export function buildWebSearchUrl(command: WebSearchCommand): URL {
  const url = new URL(WEB_SEARCH_ENDPOINT);
  url.searchParams.set("q", command.query);
  url.searchParams.set("extra_snippets", "true");

  if (command.count !== undefined) {
    url.searchParams.set("count", String(command.count));
  }
  if (command.country) {
    url.searchParams.set("country", command.country);
  }
  if (command.searchLang) {
    url.searchParams.set("search_lang", command.searchLang);
  }
  if (command.freshness) {
    url.searchParams.set("freshness", command.freshness);
  }
  if (command.offset !== undefined) {
    url.searchParams.set("offset", String(command.offset));
  }
  if (command.safeSearch) {
    url.searchParams.set("safesearch", command.safeSearch);
  }

  return url;
}

export function buildLlmContextBody(
  command: LlmContextCommand,
): Record<string, unknown> {
  return {
    q: command.query,
    ...(command.count !== undefined ? { count: command.count } : {}),
    ...(command.country ? { country: command.country } : {}),
    ...(command.searchLang ? { search_lang: command.searchLang } : {}),
    ...(command.freshness ? { freshness: command.freshness } : {}),
    ...(command.maximumNumberOfUrls !== undefined
      ? { maximum_number_of_urls: command.maximumNumberOfUrls }
      : {}),
    ...(command.maximumNumberOfTokens !== undefined
      ? { maximum_number_of_tokens: command.maximumNumberOfTokens }
      : {}),
    ...(command.maximumNumberOfSnippets !== undefined
      ? { maximum_number_of_snippets: command.maximumNumberOfSnippets }
      : {}),
    ...(command.maximumNumberOfTokensPerUrl !== undefined
      ? {
          maximum_number_of_tokens_per_url: command.maximumNumberOfTokensPerUrl,
        }
      : {}),
    ...(command.maximumNumberOfSnippetsPerUrl !== undefined
      ? {
          maximum_number_of_snippets_per_url:
            command.maximumNumberOfSnippetsPerUrl,
        }
      : {}),
    ...(command.contextThresholdMode
      ? { context_threshold_mode: command.contextThresholdMode }
      : {}),
    ...(command.enableLocal !== undefined
      ? { enable_local: command.enableLocal }
      : {}),
  };
}

function trimErrorBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<empty body>";
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}...` : trimmed;
}

async function fetchJson(
  input: RequestInfo | URL,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(input, {
    ...init,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = trimErrorBody(await response.text());
    throw new Error(
      `Brave API request failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  return response.json() as Promise<unknown>;
}

function toWebSearchOutput(
  command: WebSearchCommand,
  payload: WebSearchApiResponse,
): WebSearchOutput {
  return {
    mode: "web-search",
    query: payload.query?.original ?? command.query,
    moreResultsAvailable: payload.query?.more_results_available ?? false,
    results: (payload.web?.results ?? [])
      .filter(
        (
          result,
        ): result is Required<Pick<WebSearchApiResult, "title" | "url">> &
          WebSearchApiResult =>
          typeof result.title === "string" && typeof result.url === "string",
      )
      .map((result) => ({
        title: result.title,
        url: result.url,
        ...(result.description ? { description: result.description } : {}),
        extraSnippets: result.extra_snippets ?? [],
      })),
    locations: (payload.locations?.results ?? [])
      .filter(
        (
          location,
        ): location is Required<Pick<WebSearchApiLocation, "title">> &
          WebSearchApiLocation => typeof location.title === "string",
      )
      .map((location) => ({
        ...(location.id ? { id: location.id } : {}),
        title: location.title,
        ...(location.url ? { url: location.url } : {}),
        ...(location.description ? { description: location.description } : {}),
      })),
  };
}

function toLlmContextOutput(
  command: LlmContextCommand,
  payload: LlmContextApiResponse,
): LlmContextOutput {
  const sources = Object.entries(payload.sources ?? {}).map(([url, meta]) => ({
    url,
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.hostname ? { hostname: meta.hostname } : {}),
    ...(meta.age !== undefined ? { age: meta.age } : {}),
  }));

  return {
    mode: "llm-context",
    query: command.query,
    sources,
    grounding: payload.grounding ?? {},
  };
}

export async function runBraveSearch(
  command: SearchCommand,
  deps: RunBraveSearchDeps = {},
): Promise<WebSearchOutput | LlmContextOutput> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const apiKey = await resolveApiKey(deps.toolbeltRoot, deps.env);
  const headers = {
    Accept: "application/json",
    "X-Subscription-Token": apiKey,
  };

  if (command.mode === "web-search") {
    const payload = (await fetchJson(
      buildWebSearchUrl(command),
      { headers },
      fetchImpl,
    )) as WebSearchApiResponse;
    return toWebSearchOutput(command, payload);
  }

  const payload = (await fetchJson(
    LLM_CONTEXT_ENDPOINT,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildLlmContextBody(command)),
    },
    fetchImpl,
  )) as LlmContextApiResponse;

  return toLlmContextOutput(command, payload);
}
