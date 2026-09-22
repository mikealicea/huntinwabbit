export function companyAnalysisEnabled(
  env: Record<string, string | undefined>,
) {
  const value = env.COMPANY_ANALYSIS_ENABLED ?? 'false';
  if (!['true', 'false'].includes(value))
    throw new Error('COMPANY_ANALYSIS_ENABLED must be true or false.');
  return value === 'true';
}
export function companyAnalysisConfig(env: Record<string, string | undefined>) {
  if (!companyAnalysisEnabled(env)) return { enabled: false as const };
  const apiKey = env.REDPILL_API_KEY?.trim();
  if (!apiKey || /\s/.test(apiKey))
    throw new Error(
      'REDPILL_API_KEY is required when company analysis is enabled.',
    );
  return { enabled: true as const, apiKey };
}
