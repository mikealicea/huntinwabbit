/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPostingApi } from '@/features/job-api/job-api.test-support';

beforeEach(() => mockPostingApi([]));
afterEach(() => vi.unstubAllGlobals());

import { SearchBoardContainer } from '@/features/search-board/search-board.index';
import { StoreProvider } from '@/state/state.index';

describe('job capture on the board', () => {
  it('grows rows, validates the whole batch, preserves input, and saves individual interests', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Add job links' }));
    const first = screen.getByRole('textbox', { name: 'Job link 1' });
    expect(first).toHaveFocus();
    await user.type(first, 'https://example.org/one');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interest.*for job link 1/ }),
      'highly-interested',
    );
    const second = screen.getByRole('textbox', { name: 'Job link 2' });
    await user.type(second, 'bad link');
    expect(screen.getByRole('textbox', { name: 'Job link 3' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-invalid', 'true');
    expect(first).toHaveValue('https://example.org/one');
    expect(
      screen.queryByRole('link', { name: /Open Saved opening/ }),
    ).not.toBeInTheDocument();
    await user.clear(second);
    await user.type(second, 'https://example.net/two');
    await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
    const cards = await screen.findAllByRole('article', {
      name: 'Saved opening at Company unknown',
    });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Highly interested')).toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Interest: Not set');
    expect(within(cards[1]).getByText('Salary not listed')).toBeInTheDocument();
    expect(
      screen.getByText(
        '2 saved. 0 already saved. Posting details will appear as extraction finishes.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Job link 1' })).toHaveValue('');
  });

  it('keeps a draft when capture is closed and reopened', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <SearchBoardContainer />
      </StoreProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Add job links' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Job link 1' }),
      'https://example.org/draft',
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Add job links' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Add job links' }));
    expect(screen.getByRole('textbox', { name: 'Job link 1' })).toHaveValue(
      'https://example.org/draft',
    );
  });
});

it('retains failed rows and does not duplicate successful rows on retry', async () => {
  const user = userEvent.setup();
  const api = mockPostingApi([]);
  render(
    <StoreProvider>
      <SearchBoardContainer />
    </StoreProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Add job links' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Job link 1' }),
    'www.example.org/saved',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Job link 2' }),
    'fail.example/role',
  );
  await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
  expect(
    await screen.findByText(/Some links need another try/),
  ).toBeInTheDocument();
  expect(api.records.size).toBe(1);
  expect(screen.getByRole('textbox', { name: 'Job link 1' })).toHaveValue(
    'fail.example/role',
  );
  await user.clear(screen.getByRole('textbox', { name: 'Job link 1' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Job link 1' }),
    'www.example.org/saved',
  );
  await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
  expect(
    await screen.findByText(/0 saved. 1 already saved/),
  ).toBeInTheDocument();
  expect(api.records.size).toBe(1);
});
