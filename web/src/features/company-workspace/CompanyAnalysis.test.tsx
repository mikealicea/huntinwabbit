/** @vitest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { CompanyAnalysis as Analysis } from '@/features/job-api/job-api.index';
import { mockPostingApi } from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { CompanyAnalysis } from './CompanyAnalysis.component';
import { CompanyAnalysisContainer } from './CompanyAnalysis.container';
import { CompanyAnalysisStatus } from './CompanyAnalysisStatus.component';

const id = '00000000-0000-4000-8000-000000000050';
const data: Analysis = {
  schemaVersion: 1,
  status: 'complete',
  generation: id,
  stale: false,
  totalRoles: 1,
  analyzedRoles: 1,
  completedAt: '2026-09-22T12:00:00Z',
  progress: 3,
  error: null,
  nextCursor: null,
  items: [
    {
      category: 'technology',
      label: 'TypeScript',
      qualifier: 'observed',
      explanation: 'Discussed with a team member.',
      evidence: [
        {
          roleId: id,
          roleTitle: 'Engineer',
          source: 'personal',
          excerpt: 'TypeScript is used by the team.',
        },
      ],
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());
it('renders an honest preview with accessible evidence and source attribution', async () => {
  const refresh = vi.fn();
  render(
    <CompanyAnalysis
      data={data}
      pending={false}
      failed={false}
      complete
      onRefresh={refresh}
      onRetry={vi.fn()}
      onLoadMore={vi.fn()}
    />,
  );
  expect(screen.getByText(/Single-role preview/)).toBeVisible();
  await userEvent.click(screen.getByText('Supporting evidence for TypeScript'));
  expect(screen.getByText('Personal observation')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Engineer' })).toHaveAttribute(
    'href',
    `/app/roles/${id}`,
  );
});
it.each([
  'scheduled',
  'processing',
  'disabled',
  'not-started',
  'failed',
] as const)('shows %s without blocking the role list', (status) => {
  render(
    <CompanyAnalysis
      data={{ ...data, status, stale: true, error: 'ANALYSIS_TOO_LARGE' }}
      pending={false}
      failed={false}
      complete
      onRefresh={vi.fn()}
      onRetry={vi.fn()}
      onLoadMore={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Shared requirements' }),
  ).toBeVisible();

  if (status === 'failed')
    expect(screen.getByRole('alert')).toHaveTextContent('capacity');
});
it('connects refresh and explicit lost-ack retry through a real store', async () => {
  const boundary = mockPostingApi();
  const operations: string[] = [];
  let fail = true;
  boundary.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    if (req.method === 'POST') {
      operations.push((await req.json()).operationId);
      if (fail) {
        fail = false;
        return Response.json({}, { status: 503 });
      }
    }
    return Response.json(data);
  });
  render(
    <StoreProvider>
      <CompanyAnalysisContainer companyId={id} />
    </StoreProvider>,
  );
  await screen.findByText(/Single-role preview/);
  await userEvent.click(
    screen.getByRole('button', { name: 'Refresh analysis' }),
  );
  await screen.findByRole('alert');
  await userEvent.click(
    screen.getByRole('button', { name: 'Reload analysis' }),
  );
  await waitFor(() => expect(operations).toHaveLength(2));
  expect(operations[0]).toBe(operations[1]);
});

it('does not claim there are no commonalities when the first analysis fails', () => {
  render(
    <CompanyAnalysis
      data={{
        ...data,
        status: 'failed',
        completedAt: null,
        items: [],
        error: 'ANALYSIS_FAILED',
      }}
      pending={false}
      failed={false}
      complete
      onRefresh={vi.fn()}
      onRetry={vi.fn()}
      onLoadMore={vi.fn()}
    />,
  );
  expect(
    screen.queryByText(
      'No common technologies found in the analyzed information.',
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText('No analysis results are available yet.'),
  ).toHaveLength(2);
});

it('counts down the server schedule, follows postponements, and waits honestly at zero', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-22T12:00:00Z'));
  const props = { pending: false, failed: false, onAnalyze: vi.fn() };
  const scheduled = {
    ...data,
    status: 'scheduled' as const,
    scheduledFor: '2026-09-22T12:01:00Z',
  };
  try {
    const view = render(<CompanyAnalysisStatus {...props} data={scheduled} />);
    expect(screen.getByRole('timer')).toHaveTextContent('1:00');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:59');
    view.rerender(
      <CompanyAnalysisStatus
        {...props}
        data={{ ...scheduled, scheduledFor: '2026-09-22T12:01:30Z' }}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('1:29');
    act(() => vi.advanceTimersByTime(89000));
    expect(
      screen.getByRole('status', { name: 'Company analysis status' }),
    ).toHaveTextContent('Waiting to start');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze now' })).toBeEnabled();
    view.rerender(
      <CompanyAnalysisStatus
        {...props}
        data={{ ...data, status: 'processing' }}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Company analysis status' }),
    ).toHaveTextContent('Analyzing');
    expect(screen.getByRole('button', { name: 'Analyze now' })).toBeDisabled();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
it('keeps a scheduled state without inventing a countdown on older servers', () => {
  render(
    <CompanyAnalysisStatus
      data={{ ...data, status: 'scheduled' }}
      pending={false}
      failed={false}
      onAnalyze={vi.fn()}
    />,
  );
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(
    screen.getByRole('status', { name: 'Company analysis status' }),
  ).toHaveTextContent('Analysis scheduled');
});
it('starts scheduled work immediately and retains its operation on an uncertain response', async () => {
  const boundary = mockPostingApi();
  const requests: { operationId: string; intent: string }[] = [];
  let started = false;
  boundary.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    if (req.method === 'POST') {
      requests.push(await req.json());
      if (requests.length === 1) return Response.json({}, { status: 503 });
      started = true;
    }
    return Response.json({
      ...data,
      status: started ? 'processing' : 'scheduled',
      scheduledFor: started ? null : '2026-09-22T12:01:00Z',
    });
  });
  render(
    <StoreProvider>
      <CompanyAnalysisContainer companyId={id} />
    </StoreProvider>,
  );
  const button = await screen.findByRole('button', { name: 'Analyze now' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await screen.findByRole('alert');
  await userEvent.click(
    screen.getByRole('button', { name: 'Reload analysis' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('status', { name: 'Company analysis status' }),
    ).toHaveTextContent('Analyzing'),
  );
  expect(requests).toHaveLength(2);
  expect(requests[0].intent).toBe('refresh');
  expect(requests[0].operationId).toBe(requests[1].operationId);
  expect(button).toBeDisabled();
});

it('keeps initial findings pending until the first analysis has actually run', () => {
  render(
    <CompanyAnalysis
      data={{ ...data, status: 'not-started', completedAt: null, items: [] }}
      pending={false}
      failed={false}
      complete
      onRefresh={vi.fn()}
      onRetry={vi.fn()}
      onLoadMore={vi.fn()}
    />,
  );
  expect(
    screen.getAllByText('Results will appear here when analysis finishes.'),
  ).toHaveLength(2);
});
