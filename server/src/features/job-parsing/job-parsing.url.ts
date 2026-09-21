import { parsingError } from './job-parsing.errors.ts';

export function normalizeJobUrl(input: string): string {
  const value = input.trim();
  try {
    if (!value || value.length > 8_192 || /[\s\\]/u.test(value))
      throw new Error();
    const candidate = value.startsWith('//')
      ? `https:${value}`
      : /^[a-z][a-z\d+.-]*:/i.test(value)
        ? value
        : `https://${value}`;
    const url = new URL(candidate);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes('.')
    )
      throw new Error();
    // Fragments are not transmitted to the server. Query parameters are preserved.
    url.hash = '';
    return url.href;
  } catch {
    throw parsingError('INVALID_URL');
  }
}
