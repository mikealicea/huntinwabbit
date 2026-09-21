/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';

afterEach(() => vi.unstubAllGlobals());

import { StoreProvider } from '@/state/state.index';
import { SearchBoardContainer } from './SearchBoard.container';

describe('search board', () => {
  it('shows the whole search with independent interest, priority, salary, and next action', async () => {
    mockPostingApi();
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    expect(
      await screen.findByText('5 active roles', { exact: false }),
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
    expect(within(first).getByText('No next action set')).toBeInTheDocument();
    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      `/app/roles/${postingFixtures()[0].id}`,
    );
  });

  it('keeps all stages and capture available when the search is empty', async () => {
    mockPostingApi([]);
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    expect(screen.getAllByText('No roles here yet')).toHaveLength(6);
    expect(
      await screen.findByText(/Your next opportunity starts with a link/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add job links' })).toBeEnabled();
  });
});
