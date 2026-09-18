import type { Interest } from '@/features/job-search/job-search.index';

export interface CaptureRow {
  id: number;
  url: string;
  interest: Interest;
}

export function validateCapture(rows: CaptureRow[]): {
  links: { sourceUrl: string; interest: Interest }[];
  errors: Record<number, string>;
} {
  const links: { sourceUrl: string; interest: Interest }[] = [];
  const errors: Record<number, string> = {};
  for (const row of rows) {
    if (!row.url.trim()) continue;
    try {
      const url = new URL(row.url.trim());
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error('Invalid job URL');
      links.push({ sourceUrl: url.href, interest: row.interest });
    } catch {
      errors[row.id] =
        'Enter a complete http:// or https:// job link without embedded credentials.';
    }
  }
  if (links.length === 0 && Object.keys(errors).length === 0)
    errors[rows[0].id] = 'Paste at least one job link.';
  return { links, errors };
}
