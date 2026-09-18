/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BlogIndex } from './BlogIndex.component';
import { BlogPost } from './BlogPost.component';

it('renders a supplied index without loading content or inventing missing dates', () => {
  const view = render(<BlogIndex posts={[]} />);
  expect(screen.getByRole('list')).toBeEmptyDOMElement();
  view.rerender(
    <BlogIndex
      posts={[{ route: '/blog/example', title: 'Example post', date: null }]}
    />,
  );
  expect(screen.getByRole('link', { name: 'Example post' })).toHaveAttribute(
    'href',
    '/blog/example',
  );
  expect(screen.getByRole('listitem')).toHaveTextContent(/^Example post$/);
});

it('renders post metadata and a supplied content slot', () => {
  render(
    <BlogPost title="Example post" date="Sep 18, 2026">
      <p>Supplied article body</p>
    </BlogPost>,
  );
  expect(screen.getByRole('heading', { name: 'Example post' })).toBeVisible();
  expect(screen.getByText('Supplied article body')).toBeVisible();
  expect(screen.getByText('Sep 18, 2026')).toBeVisible();
});
