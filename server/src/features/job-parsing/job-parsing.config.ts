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

// One deployment setting selects the model for posting parsing, role updates and analysis.
export function redpillCompletionConfig(
  env: Record<string, string | undefined>,
) {
  const model = env.REDPILL_MODEL?.trim() || REDPILL_MODEL;
  if (![REDPILL_MODEL, 'z-ai/glm-5.3'].includes(model))
    throw new Error(
      'REDPILL_MODEL must be deepseek/deepseek-v4.1-flash or z-ai/glm-5.3.',
    );
  return {
    model,
    endpoint:
      model === 'z-ai/glm-5.3'
        ? 'https://tee.redpill.ai/v1/chat/completions'
        : REDPILL_URL,
  };
}
