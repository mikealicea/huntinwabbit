import { importPage } from 'nextra/pages';
import type { BlogPostMetadata } from './blog.types';

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function parseBlogPostMetadata(value: unknown): BlogPostMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error('Blog post front matter must be an object.');
  }

  const metadata = value as Record<string, unknown>;

  if (typeof metadata.title !== 'string' || !metadata.title) {
    throw new Error('Blog posts require a title in their front matter.');
  }

  if (typeof metadata.date !== 'string' || !metadata.date) {
    throw new Error('Blog posts require an ISO date in their front matter.');
  }

  return {
    title: metadata.title,
    date: metadata.date,
    description:
      typeof metadata.description === 'string'
        ? metadata.description
        : undefined,
  };
}

export async function getBlogPostMetadata(
  mdxPath: string[],
): Promise<BlogPostMetadata> {
  const { metadata } = await importPage(mdxPath);

  return parseBlogPostMetadata(metadata);
}
