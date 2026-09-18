/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JobSearchProvider } from '@/features/job-search/job-search.index';
import { SearchBoard } from './SearchBoard';

describe('search board', () => {
  it('shows the whole search with independent interest, priority, salary, and next action', () => {
    render(
      <JobSearchProvider>
        <SearchBoard />
      </JobSearchProvider>,
    );
    expect(
      screen.getByText('5 active roles', { exact: false }),
    ).toHaveTextContent('5 active roles · 1 closed');
    const collected = screen.getByRole('region', { name: 'Collected' });
    expect(within(collected).getAllByRole('article')).toHaveLength(2);
    const offer = screen.getByRole('region', { name: 'Offer' });
    expect(within(offer).getByText('No roles here yet')).toBeInTheDocument();
    const first = within(collected).getByRole('article', {
      name: 'Senior Product Engineer at Northstar',
    });
    expect(
      within(first).getByText('170,000–210,000 USD / year'),
    ).toBeInTheDocument();
    expect(within(first).getByText('Highly interested')).toBeInTheDocument();
    expect(within(first).getByText('Find referral')).toBeInTheDocument();
    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      '/app/roles/northstar-product',
    );
  });

  it('keeps all stages and capture available when the search is empty', () => {
    render(
      <JobSearchProvider
        initialState={{ opportunities: [], companies: [], resumes: [] }}
      >
        <SearchBoard />
      </JobSearchProvider>,
    );
    expect(screen.getAllByText('No roles here yet')).toHaveLength(6);
    expect(
      screen.getByText(/Your next opportunity starts with a link/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add job links' })).toBeEnabled();
  });
});
