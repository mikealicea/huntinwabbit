/** @vitest-environment jsdom */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type SavedPosting,
  usePostingQuery,
} from '@/features/job-api/job-api.index';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { InterviewProcessContainer } from './InterviewProcess.container';
import { InterviewSetup } from './InterviewSetup.component';
import { InterviewStage } from './InterviewStage.component';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const process = {
  stages: [
    { id, name: 'Recruiter' },
    { id: second, name: 'Technical' },
  ],
  currentStageId: id,
};
function Connected({ roleId }: { roleId: string }) {
  const query = usePostingQuery(roleId);
  return query.data ? (
    <InterviewProcessContainer
      posting={query.data}
      title="Engineer"
      company="Example"
    />
  ) : null;
}
it('creates manual stages and persists card movement with a real store', async () => {
  const api = mockPostingApi();
  const posting: SavedPosting = postingFixtures()[0];
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Connected roleId={posting.id} />
    </StoreProvider>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Set up interview stages' }),
  );
  const dialog = screen.getByRole('dialog');
  await user.click(
    within(dialog).getByRole('button', { name: 'Enter stages manually' }),
  );
  await user.click(within(dialog).getByRole('button', { name: 'Add stage' }));
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Stage 1' }),
    'Recruiter',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Add stage' }));
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Stage 2' }),
    'Technical',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Save stages' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByRole('heading', { name: 'Choose current stage' }),
  ).toBeVisible();
  const saved = api.records.get(posting.id)?.application.interviewProcess;
  expect(saved?.stages.map((stage) => stage.name)).toEqual([
    'Recruiter',
    'Technical',
  ]);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Move to stage' }),
    saved?.stages[1].id ?? '',
  );
  await waitFor(() =>
    expect(
      api.records.get(posting.id)?.application.interviewProcess?.currentStageId,
    ).toBe(saved?.stages[1].id),
  );
  expect(
    screen.getAllByRole('article', { name: 'Current interview card' }),
  ).toHaveLength(1);
});
it('preserves identity through rename/reorder and requires an explicit position after removing the current stage', async () => {
  const save = vi.fn(async () => {});
  const user = userEvent.setup();
  render(
    <InterviewSetup
      initial={process}
      busy={false}
      error=""
      onClose={vi.fn()}
      onSave={save}
      onTranscript={vi.fn()}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: 'Stage 2' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Stage 2' }),
    'Pair programming',
  );
  await user.click(screen.getByRole('button', { name: 'Move stage 2 up' }));
  await user.click(screen.getByRole('button', { name: 'Save stages' }));
  expect(save).toHaveBeenCalledWith({
    stages: [{ id: second, name: 'Pair programming' }, process.stages[0]],
    currentStageId: id,
  });
  save.mockClear();
  await user.click(screen.getByRole('button', { name: 'Remove stage 2' }));
  await user.click(screen.getByRole('button', { name: 'Save stages' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'current stage was removed',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Current stage' }),
    '',
  );
  await user.click(screen.getByRole('button', { name: 'Save stages' }));
  expect(save).toHaveBeenCalledWith({
    stages: [{ id: second, name: 'Pair programming' }],
    currentStageId: null,
  });
});
it('submits full transcripts intact and rejects oversize text without truncating the draft', async () => {
  const transcript = vi.fn(async () => {});
  const user = userEvent.setup();
  render(
    <InterviewSetup
      initial={null}
      busy={false}
      error=""
      onClose={vi.fn()}
      onSave={vi.fn()}
      onTranscript={transcript}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Recruiter transcript' });
  const text = 'Fictional transcript. '.repeat(3000).trim();
  fireEvent.change(input, { target: { value: text } });
  await user.click(
    screen.getByRole('button', { name: 'Extract interview stages' }),
  );
  expect(transcript).toHaveBeenCalledWith(text);
  transcript.mockClear();
  fireEvent.change(input, { target: { value: 'x'.repeat(100001) } });
  await user.click(
    screen.getByRole('button', { name: 'Extract interview stages' }),
  );
  expect(transcript).not.toHaveBeenCalled();
  expect((input as HTMLTextAreaElement).value.length).toBe(100001);
  expect(screen.getByRole('alert')).toHaveTextContent('100,000');
});
it('retains saved position and displays a recoverable error after a failed move', async () => {
  const posting: SavedPosting = postingFixtures()[0];
  posting.application.interviewProcess = process;
  const api = mockPostingApi([posting]);
  const fetcher = api.fetcher;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      return req.method === 'PATCH'
        ? Response.json({}, { status: 409 })
        : fetcher(input, init);
    }),
  );
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Connected roleId={posting.id} />
    </StoreProvider>,
  );
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Move to stage' }),
    second,
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('This role changed'),
  );
  expect(
    api.records.get(posting.id)?.application.interviewProcess?.currentStageId,
  ).toBe(id);
});

it('opens details for a future step without moving the card and restores the opener on close', async () => {
  const posting: SavedPosting = postingFixtures()[0];
  posting.application.interviewProcess = {
    ...process,
    stages: [
      process.stages[0],
      {
        ...process.stages[1],
        context: '**Duration:** 60 minutes. Prepare a project.',
      },
    ],
  };
  const api = mockPostingApi([posting]);
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Connected roleId={posting.id} />
    </StoreProvider>,
  );
  const open = await screen.findByRole('button', {
    name: 'Open Technical notes and details',
  });
  await user.click(open);
  const dialog = screen.getByRole('dialog', { name: 'Technical' });
  expect(within(dialog).getByText(/60 minutes/)).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  expect(
    api.records.get(posting.id)?.application.interviewProcess?.currentStageId,
  ).toBe(id);
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(open).toHaveFocus());
});
it('keeps notes mounted if their step is removed while the details dialog is open', () => {
  const view = render(
    <InterviewStage
      stage={{ name: 'Technical' }}
      notes={<textarea aria-label="Draft" defaultValue="Keep my draft" />}
      onClose={vi.fn()}
    />,
  );
  view.rerender(
    <InterviewStage
      stage={undefined}
      notes={<textarea aria-label="Draft" defaultValue="Keep my draft" />}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue(
    'Keep my draft',
  );
  expect(screen.getByRole('status')).toHaveTextContent('step was removed');
});
