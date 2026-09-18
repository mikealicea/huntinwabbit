import { describe, expect, it } from 'vitest';
import { formatDate, parseBlogPostMetadata } from './blog.utils';

describe('blog utilities', () => {
  it('formats post dates consistently', () => {
    expect(formatDate(new Date('2026-07-28'))).toBe('Jul 28, 2026');
  });

  it('parses valid post front matter', () => {
    expect(
      parseBlogPostMetadata({
        title: 'Hello, World',
        date: '2026-07-28',
        description: 'A first post.',
      }),
    ).toEqual({
      title: 'Hello, World',
      date: '2026-07-28',
      description: 'A first post.',
    });
  });

  it('rejects front matter without a title', () => {
    expect(() => parseBlogPostMetadata({ date: '2026-07-28' })).toThrow(
      'Blog posts require a title',
    );
  });
});
