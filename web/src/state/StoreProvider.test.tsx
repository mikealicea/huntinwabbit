/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applicationUpdated,
  selectOpportunity,
} from '@/features/job-search/job-search.index';
import { StoreProvider } from './StoreProvider';
import { selectToday } from './state.clock';
import { useAppDispatch, useAppSelector } from './state.hooks';

function WorkspaceProbe() {
  const today = useAppSelector(selectToday);
  const notes = useAppSelector(
    (state) => selectOpportunity(state, 'northstar-product')?.notes,
  );
  const dispatch = useAppDispatch();
  return (
    <>
      <p>Date: {today}</p>
      <p>Notes: {notes}</p>
      <button
        type="button"
        onClick={() =>
          dispatch(
            applicationUpdated({
              id: 'northstar-product',
              changes: { notes: 'Edited' },
            }),
          )
        }
      >
        Edit
      </button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('workspace provider lifecycle', () => {
  it('retains edits on rerender and clears them on an account key change', () => {
    const { rerender } = render(
      <StoreProvider key="account-a">
        <WorkspaceProbe />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    rerender(
      <StoreProvider key="account-a">
        <WorkspaceProbe />
      </StoreProvider>,
    );
    expect(screen.getByText('Notes: Edited')).toBeInTheDocument();
    rerender(
      <StoreProvider key="account-b">
        <WorkspaceProbe />
      </StoreProvider>,
    );
    expect(screen.getByText('Notes:')).toBeInTheDocument();
  });

  it('does not share state between simultaneous providers', () => {
    render(
      <>
        <section aria-label="First">
          <StoreProvider>
            <WorkspaceProbe />
          </StoreProvider>
        </section>
        <section aria-label="Second">
          <StoreProvider>
            <WorkspaceProbe />
          </StoreProvider>
        </section>
      </>,
    );
    const first = within(screen.getByRole('region', { name: 'First' }));
    const second = within(screen.getByRole('region', { name: 'Second' }));
    fireEvent.click(first.getByRole('button', { name: 'Edit' }));
    expect(first.getByText('Notes: Edited')).toBeInTheDocument();
    expect(second.getByText('Notes:')).toBeInTheDocument();
  });

  it('refreshes local dates on mount, minute ticks and visibility, and cleans up under Strict Mode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 23, 59, 30));
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <StrictMode>
        <StoreProvider>
          <WorkspaceProbe />
        </StoreProvider>
      </StrictMode>,
    );
    expect(screen.getByText('Date: 2026-09-18')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText('Date: 2026-09-19')).toBeInTheDocument();
    vi.setSystemTime(new Date(2026, 8, 21, 12));
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByText('Date: 2026-09-21')).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(
      remove.mock.calls.filter(([name]) => name === 'visibilitychange'),
    ).toHaveLength(2);
  });

  it('hydrates deterministic server state before reading the browser clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const ui = (
      <StoreProvider>
        <WorkspaceProbe />
      </StoreProvider>
    );
    const html = renderToString(ui);
    expect(html).not.toContain('2026-09-18');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const errors = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, ui, { onRecoverableError: errors });
    });
    expect(container).toHaveTextContent('Date: 2026-09-18');
    expect(errors).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
