export const REDPILL_URL = 'https://api.redpill.ai/v1/chat/completions';
export const REDPILL_MODEL = 'deepseek/deepseek-v4.1-flash';
export const FETCH_TIMEOUT_MS = 20_000;
export const MODEL_TIMEOUT_MS = 35_000;
export const PARSE_TIMEOUT_MS = 60_000;

export function jobParsingConfig(
  env: Record<string, string | undefined>,
): { enabled: false } | { enabled: true; apiKey: string } {
  const enabled = env.JOB_PARSING_ENABLED ?? 'false';
  if (enabled !== 'true' && enabled !== 'false')
    throw new Error('JOB_PARSING_ENABLED must be true or false.');
  if (enabled === 'false') return { enabled: false };
  const apiKey = env.REDPILL_API_KEY?.trim();
  if (!apiKey || /\s/.test(apiKey))
    throw new Error('REDPILL_API_KEY is required when job parsing is enabled.');
  return { enabled: true, apiKey };
}
