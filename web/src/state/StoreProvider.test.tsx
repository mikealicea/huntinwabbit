/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { helloApi } from '@/features/hello/hello.index';
import { StoreProvider } from './StoreProvider.provider';
import { useAppDispatch, useAppSelector } from './state.hooks';

function Probe() {
  const message = useAppSelector(
    (state) => helloApi.endpoints.hello.select()(state).data?.message,
  );
  const dispatch = useAppDispatch();
  return (
    <>
      <p>Result: {message}</p>
      <button
        type="button"
        onClick={() =>
          dispatch(
            helloApi.util.upsertQueryEntries([
              {
                endpointName: 'hello',
                arg: undefined,
                value: { message: 'Hello, world!' },
              },
            ]),
          )
        }
      >
        Seed
      </button>
    </>
  );
}
it('retains results across rerenders and clears them for another account', () => {
  const { rerender } = render(
    <StoreProvider key="a">
      <Probe />
    </StoreProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Seed' }));
  rerender(
    <StoreProvider key="a">
      <Probe />
    </StoreProvider>,
  );
  expect(screen.getByText('Result: Hello, world!')).toBeVisible();
  rerender(
    <StoreProvider key="b">
      <Probe />
    </StoreProvider>,
  );
  expect(screen.getByText('Result:')).toBeVisible();
});
it('isolates simultaneous providers', async () => {
  render(
    <>
      <section aria-label="First">
        <StoreProvider>
          <Probe />
        </StoreProvider>
      </section>
      <section aria-label="Second">
        <StoreProvider>
          <Probe />
        </StoreProvider>
      </section>
    </>,
  );
  const first = within(screen.getByRole('region', { name: 'First' }));
  const second = within(screen.getByRole('region', { name: 'Second' }));
  fireEvent.click(first.getByRole('button', { name: 'Seed' }));
  expect(await first.findByText('Result: Hello, world!')).toBeVisible();
  expect(second.getByText('Result:')).toBeVisible();
});
it('hydrates without recovering from a server/client mismatch', async () => {
  const ui = (
    <StoreProvider>
      <Probe />
    </StoreProvider>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  const errors = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, ui, { onRecoverableError: errors });
  });
  expect(errors).not.toHaveBeenCalled();
  expect(container).toHaveTextContent('Result:');
  act(() => root.unmount());
  container.remove();
});
