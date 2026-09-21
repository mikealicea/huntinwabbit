/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreProvider } from '@/state/state.index';
import { Hello } from './Hello.component';
import { HelloContainer } from './Hello.container';

const NativeRequest = Request;
beforeEach(() => {
  vi.stubGlobal(
    'Request',
    class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === 'string'
            ? new URL(input, 'http://localhost')
            : input,
          init,
        );
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
it('renders presentation states and emits requests without a store', () => {
  const onRequest = vi.fn();
  const { rerender } = render(<Hello pending={false} onRequest={onRequest} />);
  expect(screen.getByText('No request yet.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Call API' }));
  expect(onRequest).toHaveBeenCalledOnce();
  rerender(<Hello pending onRequest={onRequest} />);
  expect(screen.getByRole('button')).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Waiting');
  rerender(
    <Hello pending={false} message="Hello, world!" onRequest={onRequest} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Hello, world!');
  rerender(
    <Hello
      pending={false}
      message="Hello, world!"
      error="Request failed"
      onRequest={onRequest}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Request failed');
  expect(screen.queryByText('Hello, world!')).toBeNull();
});
it('uses a real store for loading, failure, deliberate retry and success', async () => {
  let finish: (response: Response) => void = () => {};
  const network = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(Response.json({ message: 'Hello, world!' }));
  vi.stubGlobal('fetch', network);
  render(
    <StoreProvider>
      <HelloContainer />
    </StoreProvider>,
  );
  expect(network).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Call API' }));
  expect(await screen.findByText('Waiting for the API…')).toBeVisible();
  // Wait for fetchBaseQuery's asynchronous request construction.
  await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(1));
  finish(Response.json({ message: 'unavailable' }, { status: 503 }));
  expect(
    await screen.findByText('Unable to reach the API. Please try again.'),
  ).toBeVisible();
  expect(network).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Call API' }));
  expect(await screen.findByText('Hello, world!')).toBeVisible();
  expect(network).toHaveBeenCalledTimes(2);
});
it('offers login again when the session expires', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({}, { status: 401 })),
  );
  render(
    <StoreProvider>
      <HelloContainer />
    </StoreProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Call API' }));
  expect(
    await screen.findByText('Your session has expired. Please log in again.'),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
    'href',
    '/login',
  );
});
