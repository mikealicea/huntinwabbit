/** @vitest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strFromU8, unzipSync } from 'fflate';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewProcessContainer } from '@/features/interview-process/interview-process.index';
import {
  postingApi,
  type RoleNote,
  type SavedPosting,
} from '@/features/job-api/job-api.index';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { type AppStore, makeStore } from '@/state/state.store';
import { PrepMaterialsContainer } from './PrepMaterials.container';
import { formatPrepMaterials, type PrepFilename } from './role-workspace.prep';

const stageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherStageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const timestamp = '2026-10-19T12:00:00.000Z';
const filenames: PrepFilename[] = [
  'job-listing.md',
  'company-context.md',
  'role-context.md',
];
const stores: AppStore[] = [];
let clipboardDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  for (const store of stores) store.dispatch(postingApi.util.resetApiState());
  stores.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (clipboardDescriptor)
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function setup() {
  const postings = postingFixtures()
    .slice(0, 2)
    .map((posting) => ({
      ...posting,
      companyAssociation: undefined,
      application: {
        ...posting.application,
        stage: 'interviewing' as const,
        interviewProcess: {
          stages: [
            { id: otherStageId, name: 'Recruiter' },
            {
              id: stageId,
              name: 'Technical',
              context: 'Saved coding instructions',
            },
          ],
          currentStageId: otherStageId,
        },
      },
    }));
  const posting = postings[0];
  const boundary = mockPostingApi(postings);
  const original = boundary.fetcher.getMockImplementation();
  if (!original) throw new Error('Missing HTTP boundary');
  const requests: Request[] = [];
  const intercept =
    vi.fn<
      (url: URL, request: Request) => Response | Promise<Response> | undefined
    >();
  boundary.fetcher.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return (
      (await intercept(new URL(request.url), request)) ?? original(input, init)
    );
  });
  const notes: RoleNote[] = Array.from({ length: 21 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    body:
      index === 20 ? 'Last-page saved role email' : `Saved comment ${index}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    interviewStageId: index % 2 ? stageId : null,
  }));
  boundary.notes.set(posting.id, notes);
  boundary.sources.set(posting.id, {
    text: 'Retained listing only: café\n```ts\nconst x = 1;\n```',
    sourceUrl: posting.sourceUrl,
    revision: stageId,
    updatedAt: timestamp,
  });
  const store = makeStore();
  stores.push(store);
  const user = userEvent.setup();
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue();
  setClipboard(writeText);
  const createUrl = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValue('blob:prep');
  const revokeUrl = vi.fn<(url: string) => void>();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    },
  );
  const downloads: { filename: string; url: string }[] = [];
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ filename: this.download, url: this.href });
    });
  const args = { roleId: posting.id, stageId };
  function tree(
    props: Partial<{ roleId: string; stageId: string; disabled: boolean }> = {},
  ) {
    return (
      <Provider store={store}>
        <PrepMaterialsContainer {...args} disabled={false} {...props} />
      </Provider>
    );
  }
  function preparedDocuments() {
    const context = postingApi.endpoints.prepContext.select(args)(
      store.getState(),
    ).data;
    if (!context) throw new Error('Export was not prepared');
    return formatPrepMaterials(context);
  }
  return {
    ...boundary,
    args,
    posting,
    postings,
    store,
    user,
    intercept,
    requests,
    writeText,
    createUrl,
    revokeUrl,
    downloads,
    click,
    tree,
    preparedDocuments,
  };
}

async function prepare(user: { click: (element: Element) => Promise<void> }) {
  await user.click(
    screen.getByRole('button', { name: 'Export prep materials' }),
  );
  await screen.findByText('Three prep documents ready.');
}

function expectNoOutputs() {
  expect(
    screen.queryByRole('button', { name: 'Download all (.zip)' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Download Markdown:/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Copy Markdown:/ }),
  ).not.toBeInTheDocument();
}

function readBlob(blob: Blob): Promise<Uint8Array> {
  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string' || reader.result === null)
      reject(new Error('Expected binary Blob'));
    else resolve(new Uint8Array(reader.result));
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(blob);
  return promise;
}

it('starts only on explicit intent, disables repeat starts and copies each document independently', async () => {
  const fixture = setup();
  render(fixture.tree());
  expect(fixture.requests).toHaveLength(0);
  expect(
    screen.getByText(/Review personal information before sharing/),
  ).toBeVisible();
  expectNoOutputs();
  const pending = Promise.withResolvers<Response>();
  fixture.intercept.mockImplementationOnce(() => pending.promise);
  const start = screen.getByRole('button', { name: 'Export prep materials' });
  fireEvent.click(start);
  fireEvent.click(start);
  await waitFor(() => expect(fixture.requests).toHaveLength(1));
  expect(start).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Preparing export…');
  expectNoOutputs();
  await act(async () => {
    pending.resolve(Response.json({ schemaVersion: 1, item: fixture.posting }));
  });
  await screen.findByText('Three prep documents ready.');
  expect(fixture.createUrl).not.toHaveBeenCalled();
  expect(fixture.writeText).not.toHaveBeenCalled();
  const materials = fixture.preparedDocuments();
  for (const document of materials.documents) {
    await fixture.user.click(
      screen.getByRole('button', {
        name: `Copy Markdown: ${document.filename}`,
      }),
    );
    expect(fixture.writeText).toHaveBeenLastCalledWith(document.markdown);
    expect(screen.getByRole('status')).toHaveTextContent(
      `${document.filename} copied.`,
    );
  }
  expect(fixture.writeText).toHaveBeenCalledTimes(3);
  expect(fixture.requests.every((request) => request.method === 'GET')).toBe(
    true,
  );
  expect(
    screen.getByText(/Export again after saving more context/),
  ).toBeVisible();
});

it('removes a previous bundle during refresh and failure, then explicitly retries all reads', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: role-context.md' }),
  );
  const failed = Promise.withResolvers<Response>();
  fixture.intercept.mockImplementation((url) =>
    url.pathname.endsWith('/notes') && url.searchParams.has('cursor')
      ? failed.promise
      : undefined,
  );
  await fixture.user.click(
    screen.getByRole('button', { name: 'Export again' }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Preparing export…');
  expect(screen.queryByText('role-context.md copied.')).not.toBeInTheDocument();
  expectNoOutputs();
  await act(async () => {
    failed.resolve(
      Response.json({ message: 'Private upstream payload' }, { status: 503 }),
    );
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load role comments. No export was created. Try again.',
  );
  expect(
    screen.queryByText(/Private upstream payload/),
  ).not.toBeInTheDocument();
  expectNoOutputs();
  const beforeRetry = fixture.requests.length;
  fixture.intercept.mockReset();
  await fixture.user.click(
    screen.getByRole('button', { name: 'Retry export' }),
  );
  await screen.findByText('Three prep documents ready.');
  expect(new URL(fixture.requests[beforeRetry].url).pathname).toBe(
    `/api/job-postings/${fixture.posting.id}`,
  );
  expect(
    fixture.requests
      .slice(beforeRetry)
      .filter((request) => new URL(request.url).pathname.endsWith('/notes'))
      .map((request) => new URL(request.url).searchParams.get('cursor')),
  ).toEqual([null, '20']);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: role-context.md' }),
  );
  expect(fixture.writeText).toHaveBeenLastCalledWith(
    expect.stringContaining('Last-page saved role email'),
  );
});

it.each([
  [401, 'Your session expired. Sign in again to export prep materials.'],
  [409, 'Saved context changed while exporting. Try again.'],
] as const)(
  'shows safe acquisition feedback for status %s',
  async (status, message) => {
    const fixture = setup();
    fixture.intercept.mockImplementationOnce(() =>
      Response.json({ secret: 'Do not display' }, { status }),
    );
    render(fixture.tree());
    await fixture.user.click(
      screen.getByRole('button', { name: 'Export prep materials' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/Do not display/)).not.toBeInTheDocument();
    expectNoOutputs();
  },
);

it('does not announce clipboard success before fulfillment and permits retry after rejection or a missing API', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  const pending = Promise.withResolvers<void>();
  fixture.writeText.mockReturnValueOnce(pending.promise);
  const copy = screen.getByRole('button', {
    name: 'Copy Markdown: job-listing.md',
  });
  await fixture.user.click(copy);
  expect(screen.queryByText('job-listing.md copied.')).not.toBeInTheDocument();
  await act(async () =>
    pending.reject(new Error('Permission denied with private details')),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not copy job-listing.md. Download that Markdown document instead.',
  );
  expect(screen.queryByText('job-listing.md copied.')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Download all (.zip)' }),
  ).toBeEnabled();
  setClipboard();
  await fixture.user.click(copy);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not copy job-listing.md.',
  );
  setClipboard(fixture.writeText);
  await fixture.user.click(copy);
  expect(screen.getByRole('status')).toHaveTextContent(
    'job-listing.md copied.',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('downloads one real ZIP and byte-identical individual Markdown with deferred URL cleanup', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  const materials = fixture.preparedDocuments();
  fireEvent.click(screen.getByRole('button', { name: 'Download all (.zip)' }));
  expect(fixture.createUrl).toHaveBeenCalledTimes(1);
  expect(fixture.revokeUrl).not.toHaveBeenCalled();
  expect(fixture.downloads).toEqual([
    { filename: materials.archiveFilename, url: 'blob:prep' },
  ]);
  expect(document.querySelector('a[download]')).toBeNull();
  const zipBlob = fixture.createUrl.mock.calls[0][0];
  expect(zipBlob.type).toBe('application/zip');
  const entries = unzipSync(await readBlob(zipBlob));
  expect(Object.keys(entries)).toEqual(filenames);
  for (const [index, document] of materials.documents.entries()) {
    fireEvent.click(
      screen.getByRole('button', {
        name: `Download Markdown: ${document.filename}`,
      }),
    );
    const blob = fixture.createUrl.mock.calls[index + 1][0];
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    const bytes = await readBlob(blob);
    expect(bytes).toEqual(entries[document.filename]);
    expect(strFromU8(bytes)).toBe(document.markdown);
    expect(fixture.downloads[index + 1].filename).toBe(
      document.downloadFilename,
    );
  }
  await waitFor(() => expect(fixture.revokeUrl).toHaveBeenCalledTimes(4));
});

it('recovers from ZIP output failure without losing individual documents or refetching sources', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  const reads = fixture.requests.length;
  fixture.createUrl.mockImplementationOnce(() => {
    throw new Error('Object URL unavailable');
  });
  await fixture.user.click(
    screen.getByRole('button', { name: 'Download all (.zip)' }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not download the ZIP. Try again or download the Markdown documents individually.',
  );
  for (const filename of filenames)
    expect(
      screen.getByRole('button', { name: `Copy Markdown: ${filename}` }),
    ).toBeEnabled();
  await fixture.user.click(
    screen.getByRole('button', { name: 'Download Markdown: role-context.md' }),
  );
  expect(fixture.downloads[0].filename).toBe(
    'company-senior-product-engineer-role-context.md',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await fixture.user.click(
    screen.getByRole('button', { name: 'Download all (.zip)' }),
  );
  expect(fixture.downloads[1].filename).toMatch(/\.zip$/);
  expect(fixture.requests).toHaveLength(reads);
});

it('keeps the bundle after an individual download fails and revokes its object URL', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  fixture.click.mockImplementationOnce(() => {
    throw new Error('Blocked download');
  });
  await fixture.user.click(
    screen.getByRole('button', {
      name: 'Download Markdown: company-context.md',
    }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not download company-context.md. Try again or copy that document.',
  );
  expect(document.querySelector('a[download]')).toBeNull();
  await waitFor(() =>
    expect(fixture.revokeUrl).toHaveBeenCalledWith('blob:prep'),
  );
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: company-context.md' }),
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'company-context.md copied.',
  );
});

const transitions = ['close', 'disable', 'role', 'stage', 'account'] as const;
describe.each(transitions)('%s lifetime', (transition) => {
  it('aborts acquisition, clears its cache and never continues to another cursor page', async () => {
    const fixture = setup();
    const pending = Promise.withResolvers<Response>();
    fixture.intercept.mockImplementation((url) =>
      url.pathname.endsWith('/notes') ? pending.promise : undefined,
    );
    const nextStore = makeStore();
    stores.push(nextStore);
    function tree(changed: boolean) {
      const accountChanged = changed && transition === 'account';
      return (
        <Provider
          key={accountChanged ? 'new-account' : 'first-account'}
          store={accountChanged ? nextStore : fixture.store}
        >
          {!(changed && transition === 'close') && (
            <PrepMaterialsContainer
              roleId={
                changed && transition === 'role'
                  ? fixture.postings[1].id
                  : fixture.posting.id
              }
              stageId={
                changed && transition === 'stage' ? otherStageId : stageId
              }
              disabled={changed && transition === 'disable'}
            />
          )}
        </Provider>
      );
    }
    const view = render(tree(false));
    await fixture.user.click(
      screen.getByRole('button', { name: 'Export prep materials' }),
    );
    await waitFor(() =>
      expect(
        fixture.requests.some((request) =>
          new URL(request.url).pathname.endsWith('/notes'),
        ),
      ).toBe(true),
    );
    const noteRequest = fixture.requests.find((request) =>
      new URL(request.url).pathname.endsWith('/notes'),
    );
    view.rerender(tree(true));
    expect(noteRequest?.signal.aborted).toBe(true);
    await act(async () =>
      pending.resolve(
        Response.json({
          schemaVersion: 1,
          items: [],
          nextCursor: 'older-page',
        }),
      ),
    );
    expect(
      fixture.requests.some((request) =>
        new URL(request.url).searchParams.has('cursor'),
      ),
    ).toBe(false);
    expect(
      postingApi.endpoints.prepContext.select(fixture.args)(
        fixture.store.getState(),
      ).isUninitialized,
    ).toBe(true);
    expectNoOutputs();
    expect(fixture.createUrl).not.toHaveBeenCalled();
    expect(fixture.writeText).not.toHaveBeenCalled();
    if (transition === 'disable')
      expect(
        screen.getByRole('button', { name: 'Export prep materials' }),
      ).toBeDisabled();
    fixture.intercept.mockReset();
    view.rerender(tree(false));
    await prepare(fixture.user);
    expect(fixture.preparedDocuments().documents[2].markdown).toContain(
      'Last-page saved role email',
    );
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores late clipboard %s feedback',
    async (outcome) => {
      const fixture = setup();
      function tree(changed: boolean) {
        return (
          <StoreProvider
            key={
              changed && transition === 'account'
                ? 'new-account'
                : 'first-account'
            }
          >
            {!(changed && transition === 'close') && (
              <PrepMaterialsContainer
                roleId={
                  changed && transition === 'role'
                    ? fixture.postings[1].id
                    : fixture.posting.id
                }
                stageId={
                  changed && transition === 'stage' ? otherStageId : stageId
                }
                disabled={changed && transition === 'disable'}
              />
            )}
          </StoreProvider>
        );
      }
      const view = render(tree(false));
      await prepare(fixture.user);
      const pending = Promise.withResolvers<void>();
      fixture.writeText.mockReturnValueOnce(pending.promise);
      await fixture.user.click(
        screen.getByRole('button', { name: 'Copy Markdown: role-context.md' }),
      );
      view.rerender(tree(true));
      await act(async () => {
        if (outcome === 'resolve') pending.resolve();
        else pending.reject(new Error('Late clipboard failure'));
      });
      expectNoOutputs();
      expect(
        screen.queryByText('role-context.md copied.'),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      view.rerender(tree(false));
      await prepare(fixture.user);
      expect(screen.getByRole('status')).toHaveTextContent(
        'Three prep documents ready.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});

it('invalidates an in-flight copy when Export again starts a different collection', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  const pending = Promise.withResolvers<void>();
  fixture.writeText.mockReturnValueOnce(pending.promise);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: job-listing.md' }),
  );
  await fixture.user.click(
    screen.getByRole('button', { name: 'Export again' }),
  );
  await screen.findByText('Three prep documents ready.');
  await act(async () => pending.resolve());
  expect(screen.getByRole('status')).toHaveTextContent(
    'Three prep documents ready.',
  );
  expect(screen.queryByText('job-listing.md copied.')).not.toBeInTheDocument();
});

function interviewTree(store: AppStore, posting: SavedPosting) {
  return (
    <Provider store={store}>
      <InterviewProcessContainer
        posting={posting}
        title="Fictional Engineer"
        company="Fictional Company"
        renderStageNotes={() => (
          <textarea aria-label="Unsaved note" defaultValue="Keep this draft" />
        )}
        renderStagePrep={(id) => (
          <PrepMaterialsContainer
            roleId={posting.id}
            stageId={id}
            disabled={false}
          />
        )}
      />
    </Provider>
  );
}

it('unmounts the export slot on step removal without remounting the notes draft or moving the current card', async () => {
  const fixture = setup();
  const pending = Promise.withResolvers<Response>();
  fixture.intercept.mockImplementation((url) =>
    url.pathname.endsWith('/notes') ? pending.promise : undefined,
  );
  const view = render(interviewTree(fixture.store, fixture.posting));
  await fixture.user.click(
    screen.getByRole('button', { name: 'Open Technical notes and details' }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Technical' });
  expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  const draft = within(dialog).getByRole('textbox', { name: 'Unsaved note' });
  await fixture.user.click(
    within(dialog).getByRole('button', { name: 'Export prep materials' }),
  );
  await waitFor(() =>
    expect(
      fixture.requests.some((request) =>
        new URL(request.url).pathname.endsWith('/notes'),
      ),
    ).toBe(true),
  );
  view.rerender(
    interviewTree(fixture.store, {
      ...fixture.posting,
      application: {
        ...fixture.posting.application,
        interviewProcess: {
          stages: [{ id: otherStageId, name: 'Recruiter' }],
          currentStageId: otherStageId,
        },
      },
    }),
  );
  expect(
    screen.getByRole('dialog', { name: 'Removed interview step' }),
  ).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Unsaved note' })).toBe(draft);
  expect(draft).toHaveValue('Keep this draft');
  expect(
    screen.queryByRole('region', { name: 'Prep materials' }),
  ).not.toBeInTheDocument();
  expect(
    fixture.requests.find((request) =>
      new URL(request.url).pathname.endsWith('/notes'),
    )?.signal.aborted,
  ).toBe(true);
  await act(async () =>
    pending.resolve(
      Response.json({ schemaVersion: 1, items: [], nextCursor: 'older-page' }),
    ),
  );
  expect(fixture.requests.every((request) => request.method === 'GET')).toBe(
    true,
  );
  expect(
    fixture.records.get(fixture.posting.id)?.application.interviewProcess
      ?.currentStageId,
  ).toBe(otherStageId);
});

it('aborts a pending export when the actual step dialog closes and restores its opener', async () => {
  const fixture = setup();
  const pending = Promise.withResolvers<Response>();
  fixture.intercept.mockImplementation((url) =>
    url.pathname.endsWith('/notes') ? pending.promise : undefined,
  );
  render(interviewTree(fixture.store, fixture.posting));
  const opener = screen.getByRole('button', {
    name: 'Open Technical notes and details',
  });
  await fixture.user.click(opener);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Export prep materials' }),
  );
  await waitFor(() =>
    expect(
      fixture.requests.some((request) =>
        new URL(request.url).pathname.endsWith('/notes'),
      ),
    ).toBe(true),
  );
  await fixture.user.click(screen.getByRole('button', { name: 'Close' }));
  expect(
    fixture.requests.find((request) =>
      new URL(request.url).pathname.endsWith('/notes'),
    )?.signal.aborted,
  ).toBe(true);
  await waitFor(() => expect(opener).toHaveFocus());
  await act(async () => {
    pending.resolve(
      Response.json({ schemaVersion: 1, items: [], nextCursor: 'older-page' }),
    );
  });
  expect(fixture.createUrl).not.toHaveBeenCalled();
  expect(fixture.writeText).not.toHaveBeenCalled();
  expect(
    fixture.requests.some((request) =>
      new URL(request.url).searchParams.has('cursor'),
    ),
  ).toBe(false);
  await fixture.user.click(opener);
  expectNoOutputs();
  expect(
    screen.getByRole('button', { name: 'Export prep materials' }),
  ).toBeEnabled();
});

it('ignores a rejected copy after the prep target is removed while retaining the notes draft', async () => {
  const fixture = setup();
  const view = render(interviewTree(fixture.store, fixture.posting));
  await fixture.user.click(
    screen.getByRole('button', { name: 'Open Technical notes and details' }),
  );
  await prepare(fixture.user);
  const draft = screen.getByRole('textbox', { name: 'Unsaved note' });
  const pending = Promise.withResolvers<void>();
  fixture.writeText.mockReturnValueOnce(pending.promise);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: role-context.md' }),
  );
  view.rerender(
    interviewTree(fixture.store, {
      ...fixture.posting,
      application: {
        ...fixture.posting.application,
        interviewProcess: null,
      },
    }),
  );
  await act(async () => pending.reject(new Error('Late clipboard failure')));
  expectNoOutputs();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Unsaved note' })).toBe(draft);
  expect(draft).toHaveValue('Keep this draft');
});

it('keeps feedback from the newest copy intent when an earlier clipboard operation settles later', async () => {
  const fixture = setup();
  render(fixture.tree());
  await prepare(fixture.user);
  const pending = Promise.withResolvers<void>();
  fixture.writeText.mockReturnValueOnce(pending.promise);
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: job-listing.md' }),
  );
  await fixture.user.click(
    screen.getByRole('button', { name: 'Copy Markdown: company-context.md' }),
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'company-context.md copied.',
  );
  await act(async () => pending.reject(new Error('Earlier copy failed')));
  expect(screen.getByRole('status')).toHaveTextContent(
    'company-context.md copied.',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
