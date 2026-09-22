/** @vitest-environment jsdom */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { UpdateEntry } from '@/features/job-api/job-api.index';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { UpdateRole, type UpdateRoleProps } from './UpdateRole.component';
import { UpdateRoleContainer } from './UpdateRole.container';

const entry: UpdateEntry = {
  id: '00000000-0000-4000-8000-123456789012',
  text: 'Set priority high',
  createdAt: '2026-09-21T00:00:00.000Z',
  status: 'applied',
  changes: [{ field: 'priority', before: 'low', after: 'high' }],
  skipped: [],
  error: null,
  undoneAt: null,
};
function props(overrides: Partial<UpdateRoleProps> = {}): UpdateRoleProps {
  return {
    entries: [],
    pending: false,
    loading: false,
    hasOlder: false,
    onOlder: vi.fn(),
    onReload: vi.fn(),
    onSend: vi.fn(async () => true),
    onUndo: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('sends text through props, supports newlines and preserves drafts on failure', async () => {
  const onSend = vi.fn(async () => false);
  const user = userEvent.setup();
  const view = render(<UpdateRole {...props({ onSend })} />);
  const input = screen.getByRole('textbox', { name: 'Your update' });
  await user.type(input, 'Salary is 150k');
  await user.keyboard('{Enter}');
  expect(onSend).not.toHaveBeenCalled();
  expect(input).toHaveValue('Salary is 150k\n');
  await user.keyboard('{Meta>}{Enter}{/Meta}');
  expect(onSend).toHaveBeenCalledWith('Salary is 150k\n');
  expect(input).toHaveValue('Salary is 150k\n');
  view.rerender(<UpdateRole {...props({ onSend: vi.fn(async () => true) })} />);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  expect(input).toHaveValue('');
});
it('shows partial updates, emits Undo and disables competing requests while pending', async () => {
  const p = props({
    entries: [
      { ...entry, status: 'partial', skipped: ['Salary units are unknown.'] },
    ],
  });
  const user = userEvent.setup();
  const view = render(<UpdateRole {...p} />);
  await user.click(screen.getByRole('button', { name: 'Update history' }));
  expect(
    within(screen.getByRole('region', { name: 'Update role' })).getByText(
      'Some changes saved',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Update role' })).getByText(
      'Not changed: Salary units are unknown.',
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Undo changes' }));
  expect(p.onUndo).toHaveBeenCalledWith(entry.id);
  view.rerender(<UpdateRole {...p} pending />);
  expect(screen.getByRole('button', { name: 'Undo changes' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Your update' })).toBeEnabled();
});
it('emits explicit retry and older-history requests', async () => {
  const p = props({
    hasOlder: true,
    entries: [
      { ...entry, status: 'failed', changes: [], error: 'Unable to finish.' },
    ],
    error: 'Could not confirm.',
  });
  render(<UpdateRole {...p} />);
  expect(screen.getByRole('region', { name: 'Update role' })).toHaveTextContent(
    'The latest update failed. See update history to review or retry.',
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Update history' }));
  await user.click(screen.getByRole('button', { name: 'Load older messages' }));
  expect(p.onOlder).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Retry update' }));
  expect(p.onRetry).toHaveBeenCalledWith(p.entries[0]);
  await user.click(
    screen.getByRole('button', { name: 'Refresh role and history' }),
  );
  expect(p.onReload).toHaveBeenCalled();
});
it('loads persisted history and submits and undoes through a real store', async () => {
  const boundary = mockPostingApi();
  const id = postingFixtures()[0].id;
  let entries: UpdateEntry[] = [];
  boundary.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname.endsWith('/undo')) {
      entries = entries.map((item) => ({
        ...item,
        undoneAt: '2026-09-22T00:00:00.000Z',
      }));
      return Response.json({ schemaVersion: 1, entry: entries[0] });
    }
    if (req.method === 'POST') {
      const body = await req.json();
      entries = [{ ...entry, id: body.operationId, text: body.text }];
      return Response.json(
        { schemaVersion: 1, entry: entries[0] },
        { status: 202 },
      );
    }
    if (url.pathname.endsWith('/updates'))
      return Response.json({
        schemaVersion: 1,
        items: entries,
        nextCursor: null,
      });
    return Response.json({ schemaVersion: 1, item: boundary.records.get(id) });
  });
  const user = userEvent.setup();
  const ui = () => (
    <StoreProvider>
      <UpdateRoleContainer roleId={id} pending={false} />
    </StoreProvider>
  );
  const view = render(ui());
  const chat = within(screen.getByRole('region', { name: 'Update role' }));
  await user.type(
    chat.getByRole('textbox', { name: 'Your update' }),
    'Set priority high',
  );
  await user.click(chat.getByRole('button', { name: 'Send' }));
  await user.click(chat.getByRole('button', { name: 'Update history' }));
  await waitFor(() =>
    expect(chat.getByText('Changes saved')).toBeInTheDocument(),
  );
  await user.click(chat.getByRole('button', { name: 'Undo changes' }));
  await waitFor(() =>
    expect(chat.getByText('Changes undone')).toBeInTheDocument(),
  );
  view.unmount();
  render(ui());
  await user.click(screen.getByRole('button', { name: 'Update history' }));
  expect(
    await within(
      screen.getByRole('region', { name: 'Update role' }),
    ).findByText('Changes undone'),
  ).toBeInTheDocument();
});

it('keeps history collapsed by default and preserves the draft when toggled', async () => {
  const user = userEvent.setup();
  render(<UpdateRole {...props({ entries: [entry] })} />);
  const toggle = screen.getByRole('button', { name: 'Update history' });
  const input = screen.getByRole('textbox', { name: 'Your update' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('log')).not.toBeInTheDocument();
  await user.type(input, 'My draft');
  toggle.focus();
  await user.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const history = screen.getByRole('log');
  expect(history).toHaveTextContent(entry.text);
  expect(
    input.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await user.keyboard(' ');
  expect(screen.queryByRole('log')).not.toBeInTheDocument();
  expect(input).toHaveValue('My draft');
});

it('ignores composing, repeated, blank and pending keyboard submissions', () => {
  const p = props();
  const view = render(<UpdateRole {...p} />);
  const input = screen.getByRole('textbox', { name: 'Your update' });
  fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
  fireEvent.change(input, { target: { value: 'Set priority high' } });
  fireEvent.keyDown(input, { key: 'Enter', metaKey: true, isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter', metaKey: true, repeat: true });
  expect(p.onSend).not.toHaveBeenCalled();
  view.rerender(<UpdateRole {...p} pending />);
  fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
  expect(p.onSend).not.toHaveBeenCalled();
  expect(input).toBeEnabled();
});
