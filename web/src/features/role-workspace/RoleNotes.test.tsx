/** @vitest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompanyNotesContainer } from '@/features/company-workspace/company-workspace.index';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { RoleNotes } from './RoleNotes.component';
import { RoleNotesContainer } from './RoleNotes.container';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe.each(['role', 'company'] as const)('%s comments', (scope) => {
  const id = postingFixtures()[0].id;
  function mockApi() {
    const api = mockPostingApi();
    api.companies.add(id);
    return {
      ...api,
      notes: scope === 'company' ? api.companyNotes : api.notes,
    };
  }
  function mount() {
    return render(
      <StoreProvider>
        {scope === 'company' ? (
          <CompanyNotesContainer companyId={id} />
        ) : (
          <RoleNotesContainer roleId={id} />
        )}
      </StoreProvider>,
    );
  }
  it('previews Markdown, persists separate comments, edits and confirms deletion', async () => {
    const api = mockApi();
    const user = userEvent.setup();
    mount();
    await screen.findByText('No comments yet. Add your first note above.');
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Add a note' }),
      '**First**\n\n- Question',
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      screen
        .getByRole('region', { name: 'Add a note preview' })
        .querySelector('strong'),
    ).toHaveTextContent('First');
    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(
      await screen.findByRole('article', { name: 'Comment' }),
    ).toHaveTextContent('First');
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue('');
    await user.type(
      screen.getByRole('textbox', { name: 'Add a note' }),
      'Second',
    );
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() =>
      expect(screen.getAllByRole('article', { name: 'Comment' })).toHaveLength(
        2,
      ),
    );
    const second = within(
      screen.getAllByRole('article', { name: 'Comment' })[0],
    );
    await user.click(second.getByRole('button', { name: 'Edit comment' }));
    await user.clear(second.getByRole('textbox', { name: 'Edit comment' }));
    await user.type(
      second.getByRole('textbox', { name: 'Edit comment' }),
      'Revised second',
    );
    await user.click(second.getByRole('button', { name: 'Save changes' }));
    expect(await second.findByText('· Edited')).toBeVisible();
    await user.click(second.getByRole('button', { name: 'Delete comment' }));
    await user.click(second.getByRole('button', { name: 'Cancel deletion' }));
    expect(api.notes.get(id)).toHaveLength(2);
    await user.click(second.getByRole('button', { name: 'Delete comment' }));
    await user.click(
      second.getByRole('button', { name: 'Delete permanently' }),
    );
    await waitFor(() => expect(api.notes.get(id)).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveFocus(),
    );
  });
  it('preserves drafts after a lost acknowledgement and retries with the same ID', async () => {
    const api = mockApi();
    const user = userEvent.setup();
    mount();
    await screen.findByText(/No comments yet/);
    const normal = api.fetcher.getMockImplementation();
    if (!normal) throw new Error();
    api.fetcher.mockImplementationOnce(async (...args) => {
      await normal(...args);
      throw new Error('lost');
    });
    await user.type(
      screen.getByRole('textbox', { name: 'Add a note' }),
      'Keep this',
    );
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
      'Keep this',
    );
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
        '',
      ),
    );
    expect(api.notes.get(id)).toHaveLength(1);
  });
  it('keeps an edit draft on conflict and requires review of the current revision', async () => {
    const api = mockApi();
    api.notes.set(id, [
      {
        id: crypto.randomUUID(),
        body: 'Original',
        revision: 1,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
      },
    ]);
    const user = userEvent.setup();
    mount();
    await screen.findByText('Original');
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit comment' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Edit comment' }),
      'My draft',
    );
    const note = api.notes.get(id)?.[0];
    if (!note) throw new Error();
    note.body = 'Other tab';
    note.revision = 2;
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Other tab');
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toHaveValue(
      'My draft',
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    const requestsBeforeShortcut = api.fetcher.mock.calls.length;
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit comment' }), {
      key: 'Enter',
      metaKey: true,
    });
    expect(api.fetcher.mock.calls).toHaveLength(requestsBeforeShortcut);
    await user.click(
      screen.getByRole('button', { name: 'I reviewed the latest comment' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.notes.get(id)?.[0]).toMatchObject({
        body: 'My draft',
        revision: 3,
      }),
    );
  });
  it('loads older pages and retains newer text entered during submission', async () => {
    const api = mockApi();
    api.notes.set(
      id,
      Array.from({ length: 21 }, (_, index) => ({
        id: crypto.randomUUID(),
        body: `Comment ${index}`,
        revision: 1,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
      })),
    );
    const user = userEvent.setup();
    const view = mount();
    await screen.findByText('Comment 0');
    await user.click(
      screen.getByRole('button', { name: 'Load older comments' }),
    );
    await screen.findByText('Comment 20');
    view.unmount();
    let finish: (success: boolean) => void = () => {};
    render(
      <RoleNotes
        notes={[]}
        loading={false}
        pending={false}
        disabled={false}
        hasOlder={false}
        onOlder={() => {}}
        onReload={() => {}}
        onCreate={() =>
          new Promise((resolve) => {
            finish = resolve;
          })
        }
        onEdit={async () => 'saved'}
        onDelete={async () => 'saved'}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Add a note' }), {
      target: { value: 'Submitted' },
    });
    const composer = screen.getByRole('textbox', { name: 'Add a note' });
    const beforeSubmit = finish;
    fireEvent.keyDown(composer, {
      key: 'Enter',
      metaKey: true,
      isComposing: true,
    });
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true, repeat: true });
    expect(finish).toBe(beforeSubmit);
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Add a note' }), {
      target: { value: 'New draft' },
    });
    await act(async () => finish(true));
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
      'New draft',
    );
  });

  it('retains a local edit when the comment disappears remotely', async () => {
    const api = mockApi();
    api.notes.set(id, [
      {
        id: crypto.randomUUID(),
        body: 'Original',
        revision: 1,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
      },
    ]);
    const user = userEvent.setup();
    mount();
    await screen.findByText('Original');
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit comment' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Edit comment' }),
      'Keep this local edit',
    );
    api.notes.set(id, []);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/This comment is no longer in the loaded list/);
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toHaveValue(
      'Keep this local edit',
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(
      screen.queryByRole('textbox', { name: 'Edit comment' }),
    ).not.toBeInTheDocument();
  });
  it('keeps loaded comments and drafts when an older page fails', async () => {
    const api = mockApi();
    api.notes.set(
      id,
      Array.from({ length: 21 }, (_, index) => ({
        id: crypto.randomUUID(),
        body: `Saved ${index}`,
        revision: 1,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
      })),
    );
    const user = userEvent.setup();
    mount();
    await screen.findByText('Saved 0');
    await user.type(
      screen.getByRole('textbox', { name: 'Add a note' }),
      'Unsaved thought',
    );
    api.fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await user.click(
      screen.getByRole('button', { name: 'Load older comments' }),
    );
    await screen.findByRole('alert');
    expect(screen.getAllByRole('article', { name: 'Comment' })).toHaveLength(
      20,
    );
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
      'Unsaved thought',
    );
    await user.click(
      screen.getByRole('button', { name: 'Load older comments' }),
    );
    await screen.findByText('Saved 20');
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
      'Unsaved thought',
    );
  });
});
