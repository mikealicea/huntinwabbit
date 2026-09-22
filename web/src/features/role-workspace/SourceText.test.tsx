/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { SourceTextContainer } from './SourceText.container';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => vi.unstubAllGlobals());
it('loads stored source, retains local edits and saves through the real API cache', async () => {
  const api = mockPostingApi();
  const item = postingFixtures()[0];
  const close = vi.fn();
  api.sources.set(item.id, {
    text: 'Original text',
    sourceUrl: item.sourceUrl,
    revision: crypto.randomUUID(),
    updatedAt: item.updatedAt,
  });
  render(
    <StoreProvider>
      <SourceTextContainer
        posting={item}
        open
        disabled={false}
        onClose={close}
      />
    </StoreProvider>,
  );
  const input = await screen.findByRole('textbox', { name: 'Page text' });
  expect(input).toHaveValue('Original text');
  fireEvent.change(input, { target: { value: 'Updated fictional posting' } });
  await userEvent.click(
    screen.getByRole('button', { name: 'Save and refresh' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(api.sources.get(item.id)?.text).toBe('Updated fictional posting');
});
it('retries uncertain requests with the same operation ID and keeps the draft', async () => {
  const api = mockPostingApi();
  const item = postingFixtures()[0];
  const actual = api.fetcher.getMockImplementation();
  if (!actual) throw new Error();
  const bodies: Record<string, unknown>[] = [];
  api.fetcher.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (request.method === 'POST') {
      bodies.push(await request.json());
      return Response.json({}, { status: 503 });
    }
    return actual(input, init);
  });
  render(
    <StoreProvider>
      <SourceTextContainer
        posting={item}
        open
        disabled={false}
        onClose={vi.fn()}
      />
    </StoreProvider>,
  );
  fireEvent.change(await screen.findByRole('textbox', { name: 'Page text' }), {
    target: { value: 'Retain this draft' },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Save and refresh' }),
  );
  await screen.findByText(/Saving could not be confirmed/);
  expect(screen.getByRole('textbox', { name: 'Page text' })).toHaveValue(
    'Retain this draft',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Save and refresh' }),
  );
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0]).toEqual(bodies[1]);
});
it('requires explicit review after a version conflict and preserves the draft', async () => {
  const api = mockPostingApi();
  const item = postingFixtures()[0];
  render(
    <StoreProvider>
      <SourceTextContainer
        posting={item}
        open
        disabled={false}
        onClose={vi.fn()}
      />
    </StoreProvider>,
  );
  fireEvent.change(await screen.findByRole('textbox', { name: 'Page text' }), {
    target: { value: 'My draft' },
  });
  const current = api.records.get(item.id);
  if (!current) throw new Error();
  current.applicationVersion++;
  await userEvent.click(
    screen.getByRole('button', { name: 'Save and refresh' }),
  );
  await screen.findByText(/This role changed/);
  expect(
    screen.getByRole('button', { name: 'Save and refresh' }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Review latest version' }),
  );
  await screen.findByText(/Latest version loaded/);
  expect(screen.getByRole('textbox', { name: 'Page text' })).toHaveValue(
    'My draft',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Save and refresh' }),
  );
  await waitFor(() => expect(api.sources.get(item.id)?.text).toBe('My draft'));
});
it('shows changed-URL source warnings and supports removal without modifying the previous facts', async () => {
  const api = mockPostingApi();
  const item = postingFixtures()[0];
  const close = vi.fn();
  api.sources.set(item.id, {
    text: 'Old URL text',
    sourceUrl: 'https://example.test/old',
    revision: crypto.randomUUID(),
    updatedAt: item.updatedAt,
  });
  render(
    <StoreProvider>
      <SourceTextContainer
        posting={item}
        open
        disabled={false}
        onClose={close}
      />
    </StoreProvider>,
  );
  await screen.findByText(/belongs to a previous link/);
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove text and refresh' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(api.sources.has(item.id)).toBe(false);
  expect(api.records.get(item.id)?.parsedPosting).toEqual(item.parsedPosting);
});
