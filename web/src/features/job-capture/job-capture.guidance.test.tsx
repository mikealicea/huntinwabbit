/** @vitest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { mockPostingApi } from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { JobCaptureContainer } from './JobCapture.container';
import { captureHostname } from './job-capture.validation';

afterEach(() => vi.unstubAllGlobals());
async function setup(handler?: (hostname: string) => Promise<Response>) {
  const api = mockPostingApi([]);
  const lookups: string[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname.endsWith('/source-guidance')) {
        const { hostname } = await request.json();
        lookups.push(hostname);
        if (handler) return handler(hostname);
        return Response.json({
          hostname,
          recommendSourceText: hostname === 'indeed.com',
        });
      }
      return api.fetcher(request);
    },
  );
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <JobCaptureContainer />
    </StoreProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Add job links' }));
  const input = screen.getByRole('textbox', { name: 'Job link 1' });
  return { api, lookups, user, input };
}
const disclosure = () =>
  screen.getByRole('button', { name: 'Paste page text for job link 1' });
const setLink = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

it.each([
  [' HTTPS://WWW.Indeed.com./viewjob?secret=token ', 'indeed.com'],
  ['//jobs.example.test/one', 'jobs.example.test'],
  ['indeed.com.evil.test/path', 'indeed.com.evil.test'],
  ['https://user:secret@indeed.com/job', ''],
  ['invalid input', ''],
  ['127.0.0.1/job', ''],
])('extracts only a normalized hostname from %s', (input, expected) =>
  expect(captureHostname(input)).toBe(expected),
);

it('opens Indeed guidance without moving focus and still permits URL-only saving', async () => {
  const { input, lookups, user, api } = await setup();
  setLink(input, 'https://www.indeed.com/viewjob?private=token');
  await waitFor(() =>
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true'),
  );
  expect(input).toHaveFocus();
  expect(screen.getByText(/This site may block scanning/)).toBeVisible();
  expect(lookups).toEqual(['indeed.com']);
  act(() => screen.getByRole('button', { name: 'Save to Collected' }).focus());
  expect(screen.getByText(/This site may block scanning/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
  await screen.findByText(/1 saved/);
  expect(api.records.size).toBe(1);
});
it('keeps pasted drafts, respects dismissal for the same hostname, and reopens after a hostname change', async () => {
  const { input, user } = await setup();
  setLink(input, 'indeed.com/one');
  const editor = await screen.findByRole('textbox', {
    name: 'Page text for job link 1',
  });
  await user.type(editor, 'Fictional job description');
  await user.click(
    screen.getByRole('button', {
      name: 'Done with pasted text for job link 1',
    }),
  );
  expect(
    screen.getByRole('button', { name: 'Edit page text for job link 1' }),
  ).toHaveFocus();
  setLink(input, 'www.indeed.com/two');
  expect(editor).not.toBeVisible();
  await user.click(input);
  setLink(input, 'other.example.test/job');
  setLink(input, 'indeed.com/three');
  await waitFor(() => expect(editor).toBeVisible());
  expect(editor).toHaveValue('Fictional job description');
  expect(input).toHaveFocus();
});
it('ignores a delayed response after the URL changes or focus moves to another row', async () => {
  let resolve: ((response: Response) => void) | undefined;
  const { input, lookups, user } = await setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  setLink(input, 'indeed.com/one');
  await waitFor(() => expect(lookups).toHaveLength(1));
  setLink(input, 'other.example.test/role');
  await user.click(screen.getByRole('textbox', { name: 'Job link 2' }));
  await act(async () =>
    resolve?.(
      Response.json({ hostname: 'indeed.com', recommendSourceText: true }),
    ),
  );
  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen.queryByText(/This site may block scanning/),
  ).not.toBeInTheDocument();
});
it('does not open a closed form when a lookup finishes', async () => {
  let resolve: ((response: Response) => void) | undefined;
  const { input, lookups, user } = await setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  setLink(input, 'indeed.com/one');
  await waitFor(() => expect(lookups).toHaveLength(1));
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () =>
    resolve?.(
      Response.json({ hostname: 'indeed.com', recommendSourceText: true }),
    ),
  );
  expect(screen.getByRole('button', { name: 'Add job links' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(
    screen.queryByText(/This site may block scanning/),
  ).not.toBeInTheDocument();
});
it('deduplicates the same hostname across rows and only opens the active editor', async () => {
  const { input, lookups, user } = await setup();
  setLink(input, 'indeed.com/one');
  await screen.findByRole('textbox', { name: 'Page text for job link 1' });
  const second = screen.getByRole('textbox', { name: 'Job link 2' });
  await user.click(second);
  setLink(second, 'www.indeed.com/two');
  await screen.findByRole('textbox', { name: 'Page text for job link 2' });
  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  expect(second).toHaveFocus();
  expect(lookups).toEqual(['indeed.com']);
});
it('keeps manual capture available when guidance is unavailable or malformed', async () => {
  const { input, lookups, user } = await setup(async () =>
    Response.json({ raw: 'untrusted upstream data' }, { status: 503 }),
  );
  setLink(input, 'jobs.example.test/one');
  await waitFor(() => expect(lookups).toHaveLength(1));
  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  await user.click(disclosure());
  expect(
    await screen.findByRole('textbox', { name: 'Page text for job link 1' }),
  ).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Save to Collected' }));
  await screen.findByText(/1 saved/);
});

it('does not expand after focus leaves the row for a form action', async () => {
  let resolve: ((response: Response) => void) | undefined;
  const { input, lookups } = await setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  setLink(input, 'indeed.com/one');
  await waitFor(() => expect(lookups).toHaveLength(1));
  act(() => screen.getByRole('button', { name: 'Save to Collected' }).focus());
  expect(
    screen.getByRole('button', { name: 'Save to Collected' }),
  ).toHaveFocus();
  await act(async () =>
    resolve?.(
      Response.json({ hostname: 'indeed.com', recommendSourceText: true }),
    ),
  );
  expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
});
