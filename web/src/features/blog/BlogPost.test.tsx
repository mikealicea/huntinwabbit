/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPost } from './BlogPost';

const mocks = vi.hoisted(() => ({
  importPage: vi.fn(),
}));

vi.mock('nextra/pages', () => ({
  importPage: mocks.importPage,
}));

describe('blog post page', () => {
  beforeEach(() => {
    mocks.importPage.mockResolvedValue({
      default: function TestPostContent() {
        return <p>The world appears within awareness.</p>;
      },
      metadata: {
        title: 'Hello, World',
        date: '2026-07-28',
        description: 'A first post.',
      },
    });
  });

  it('renders post metadata, content, and a blog breadcrumb', async () => {
    render(await BlogPost({ mdxPath: ['hello-world'] }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Hello, World' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026')).toBeInTheDocument();
    expect(
      screen.getByText('The world appears within awareness.'),
    ).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation', {
      name: 'Breadcrumb',
    });
    expect(
      within(breadcrumb).getByRole('link', { name: 'Blog' }),
    ).toHaveAttribute('href', '/blog');
  });

  it('loads the requested MDX path', async () => {
    render(await BlogPost({ mdxPath: ['hello-world'] }));

    expect(mocks.importPage).toHaveBeenCalledWith(['hello-world']);
  });
});
