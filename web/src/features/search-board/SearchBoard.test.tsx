/** @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('shows refresh request failure on the card and allows an explicit retry', async () => {
    const api = mockPostingApi();
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    const card = await screen.findByRole('article', {
      name: 'Senior Product Engineer at Northstar',
    });
    await user.click(within(card).getByLabelText('Posting actions'));
    api.fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await user.click(
      within(card).getByRole('button', {
        name: 'Refresh posting',
      }),
    );
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      'We could not complete that request',
    );
    expect(within(card).getByText('170,000–210,000 USD / year')).toBeVisible();
    await user.click(within(card).getByLabelText('Posting actions'));
    await user.click(
      within(card).getByRole('button', {
        name: 'Refresh posting',
      }),
    );
    expect(await within(card).findByText('Refresh queued…')).toBeVisible();
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
    await user.click(within(card).getByLabelText('Posting actions'));
    expect(
      within(card).getByRole('button', { name: 'Refreshing posting…' }),
    ).toBeDisabled();
  });

  it('keeps failed deletions and requires review of a conflicting version before reconfirming', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    const api = mockPostingApi();
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    const card = await screen.findByRole('article', {
      name: 'Senior Product Engineer at Northstar',
    });
    const openConfirmation = async () => {
      await user.click(within(card).getByLabelText('Posting actions'));
      await user.click(
        within(card).getByRole('button', {
          name: 'Delete posting',
        }),
      );
    };
    await openConfirmation();
    api.fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    expect(
      await screen.findByText('Deletion could not be confirmed. Try again.'),
    ).toBeVisible();
    expect(card).toBeInTheDocument();
    const item = api.records.get(postingFixtures()[0].id);
    if (!item) throw new Error('Expected saved posting');
    api.records.set(item.id, {
      ...item,
      applicationVersion: item.applicationVersion + 1,
      recordVersion: item.recordVersion + 1,
    });
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    expect(
      await screen.findByText(/This posting changed elsewhere/),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Delete permanently' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Review posting' }));
    await openConfirmation();
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );
    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(api.records.has(item.id)).toBe(false);
    expect(
      await screen.findByText('4 active roles', { exact: false }),
    ).toBeVisible();
  });
});
