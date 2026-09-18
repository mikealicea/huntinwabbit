/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JobSearchProvider } from '@/features/job-search/job-search.index';
import { SearchBoard } from '@/features/search-board/search-board.index';

describe('job capture on the board', () => {
  it('grows rows, validates the whole batch, preserves input, and saves individual interests', async () => {
    const user = userEvent.setup();
    render(
      <JobSearchProvider>
        <SearchBoard />
      </JobSearchProvider>,
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
    const cards = screen.getAllByRole('article', {
      name: 'Saved opening at Company unknown',
    });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Highly interested')).toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Interest: Not set');
    expect(within(cards[1]).getByText('Salary not listed')).toBeInTheDocument();
    expect(
      screen.getByText(
        '2 links added to Collected. Posting details are unavailable in this sample.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Job link 1' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Job link 1' })).toHaveFocus();
  });

  it('keeps a draft when capture is closed and reopened', async () => {
    const user = userEvent.setup();
    render(
      <JobSearchProvider>
        <SearchBoard />
      </JobSearchProvider>,
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
