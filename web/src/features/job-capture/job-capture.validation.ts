import type { Interest } from '@/features/job-search/job-search.index';

export interface CaptureRow {
  id: number;
  url: string;
  interest: Interest;
  sourceText?: string;
  existingId?: string;
}

export function validateCapture(rows: CaptureRow[]): {
  links: { sourceUrl: string; interest: Interest }[];
  errors: Record<number, string>;
} {
  const links: { sourceUrl: string; interest: Interest }[] = [];
  const errors: Record<number, string> = {};
  for (const row of rows) {
    if (!row.url.trim()) {
      if (row.sourceText?.trim())
        errors[row.id] = 'Enter a job link for this page text.';
      continue;
    }
    if (pageTextError(row.sourceText ?? '')) {
      errors[row.id] = pageTextError(row.sourceText ?? '');
      continue;
    }
    try {
      const url = new URL(normalizeCaptureUrl(row.url));
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error('Invalid job URL');
      links.push({ sourceUrl: url.href, interest: row.interest });
    } catch {
      errors[row.id] = 'Enter a valid job link without embedded credentials.';
    }
  }
  if (links.length === 0 && Object.keys(errors).length === 0)
    errors[rows[0].id] = 'Paste at least one job link.';
  return { links, errors };
}

export function normalizeCaptureUrl(input: string): string {
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
    throw new Error('Invalid job URL');
  }
}

export function pageTextError(text: string): string {
  return text.length > 100_000 ||
    new TextEncoder().encode(text).byteLength > 256 * 1024
    ? 'Page text must be at most 100,000 characters and 256 KiB. Shorten it before saving.'
    : '';
}
