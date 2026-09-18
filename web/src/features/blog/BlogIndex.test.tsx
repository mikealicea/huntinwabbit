/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogIndex } from './BlogIndex';

const mocks = vi.hoisted(() => ({
  getPageMap: vi.fn(),
  normalizePages: vi.fn(),
}));

vi.mock('nextra/page-map', () => ({
  getPageMap: mocks.getPageMap,
}));

vi.mock('nextra/normalize-pages', () => ({
  normalizePages: mocks.normalizePages,
}));

describe('blog index page', () => {
  beforeEach(() => {
    mocks.getPageMap.mockResolvedValue([]);
    mocks.normalizePages.mockReturnValue({
      directories: [
        {
          name: 'older-post',
          route: '/blog/older-post',
          title: 'Older post',
          frontMatter: { date: '2025-03-10' },
        },
        {
          name: 'index',
          route: '/blog',
          title: 'Blog',
          frontMatter: {},
        },
        {
          name: 'newer-post',
          route: '/blog/newer-post',
          title: 'Newer post',
          frontMatter: { date: '2026-07-28' },
        },
      ],
    });
  });

  it('renders posts newest first and excludes the index entry', async () => {
    render(await BlogIndex());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Blog' }),
    ).toBeInTheDocument();

    const links = within(screen.getByRole('list')).getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Newer post');
    expect(links[0]).toHaveAttribute('href', '/blog/newer-post');
    expect(links[1]).toHaveTextContent('Older post');
    expect(screen.getByText('Jul 28, 2026')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Blog' }),
    ).not.toBeInTheDocument();
  });

  it('loads the page map using the blog route', async () => {
    render(await BlogIndex());

    expect(mocks.getPageMap).toHaveBeenCalledWith('/blog');
    expect(mocks.normalizePages).toHaveBeenCalledWith({
      list: [],
      route: '/blog',
      underCurrentDocsRoot: true,
    });
  });
});
