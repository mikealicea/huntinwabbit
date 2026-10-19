import { afterEach, expect, it, vi } from 'vitest';
import { type AppStore, makeStore } from '@/state/state.store';
import type { CompanyAnalysis } from './job-api.analysis.contracts';
import { postingApi } from './job-api.client';
import type { Company } from './job-api.companies.contracts';
import type { RoleNote, UpdateEntry } from './job-api.contracts';
import { loadPrepContext } from './job-api.prep';
import { mockPostingApi, postingFixtures } from './job-api.test-support';

const timestamp = '2026-10-19T12:00:00.000Z';
const uuid = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const stageId = uuid(800);
const otherStageId = uuid(801);
const removedStageId = uuid(802);
const companyId = uuid(900);
const nextCursor = 'opaque/older?token=+==';
const stores: AppStore[] = [];

afterEach(() => {
  for (const store of stores) store.dispatch(postingApi.util.resetApiState());
  stores.length = 0;
  vi.unstubAllGlobals();
});

function setup() {
  const posting = structuredClone(postingFixtures()[0]);
  posting.application.interviewProcess = {
    stages: [
      { id: otherStageId, name: 'Screen' },
      { id: stageId, name: 'Coding', context: 'Saved coding context' },
    ],
    currentStageId: otherStageId,
  };
  const company: Company = {
    id: companyId,
    name: 'Fictional Company',
    website: 'https://company.example',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  posting.companyAssociation = {
    company: { id: company.id, name: company.name, website: company.website },
    mode: 'manual',
    revision: 1,
  };
  const roleNotes: RoleNote[] = Array.from({ length: 21 }, (_, index) => ({
    id: uuid(100 + index),
    body:
      index === 20 ? 'last-page-role-note' : 'Distinct note, identical text',
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    interviewStageId: [stageId, otherStageId, null, removedStageId][index % 4],
  }));
  const companyNotes: RoleNote[] = Array.from({ length: 21 }, (_, index) => ({
    id: uuid(200 + index),
    body: `Company note ${index === 20 ? 'last-page-company-note' : index}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
  }));
  const updates: UpdateEntry[] = Array.from({ length: 6 }, (_, index) => ({
    id: uuid(300 + index),
    text: index === 5 ? 'oldest-update-sentinel' : `Update ${index}`,
    createdAt: `2026-10-${String(19 - index).padStart(2, '0')}T12:00:00.000Z`,
    status: (
      [
        'queued',
        'processing',
        'applied',
        'partial',
        'unchanged',
        'failed',
      ] as const
    )[index],
    changes: [],
    skipped: [],
    error: index === 5 ? 'Saved update failure' : null,
    undoneAt: null,
  }));
  const findings: CompanyAnalysis['items'] = Array.from(
    { length: 21 },
    (_, index) => ({
      category: 'technology',
      label: `Finding ${index}`,
      qualifier: 'used',
      explanation:
        index === 20 ? 'last-page-analysis-finding' : 'Saved finding',
      evidence: [
        {
          source: 'history',
          roleId: uuid(999),
          roleTitle: 'Another saved role',
          excerpt: `Evidence ${index}`,
        },
      ],
    }),
  );
  const analysis: Omit<CompanyAnalysis, 'items' | 'nextCursor'> = {
    schemaVersion: 1,
    status: 'complete',
    generation: uuid(901),
    stale: false,
    totalRoles: 2,
    analyzedRoles: 2,
    completedAt: timestamp,
    scheduledFor: null,
    progress: 2,
    error: null,
  };
  const boundary = mockPostingApi([posting]);
  const requests: Request[] = [];
  const intercept =
    vi.fn<
      (url: URL, request: Request) => Response | Promise<Response> | undefined
    >();
  const rolePath = `/api/job-postings/${posting.id}`;
  const companyPath = `/api/job-postings/companies/${companyId}`;
  const page = <T>(items: T[], size: number, cursor: string | null) => ({
    schemaVersion: 1,
    items: items.slice(
      cursor === null ? 0 : size,
      cursor === null ? size : undefined,
    ),
    nextCursor: cursor === null && items.length > size ? nextCursor : null,
  });
  boundary.fetcher.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    const intercepted = await intercept(url, request);
    if (intercepted) return intercepted;
    const cursor = url.searchParams.get('cursor');
    switch (url.pathname) {
      case rolePath:
        return Response.json({ schemaVersion: 1, item: posting });
      case `${rolePath}/source-text`:
        return Response.json({
          schemaVersion: 1,
          source: null,
          applicationVersion: posting.applicationVersion,
          generation: posting.extraction.generation,
        });
      case `${rolePath}/notes`:
        return Response.json(page(roleNotes, 20, cursor));
      case `${rolePath}/updates`:
        return Response.json(page(updates, 5, cursor));
      case companyPath:
        return Response.json({ schemaVersion: 1, item: company });
      case `${companyPath}/notes`:
        return Response.json(page(companyNotes, 20, cursor));
      case `${companyPath}/analysis`:
        return Response.json({ ...analysis, ...page(findings, 20, cursor) });
      default:
        throw new Error('Unexpected fictional test route');
    }
  });
  const store = makeStore();
  stores.push(store);
  const args = { roleId: posting.id, stageId };
  const start = () =>
    store.dispatch(
      postingApi.endpoints.prepContext.initiate(args, { forceRefetch: true }),
    );
  return {
    store,
    start,
    args,
    posting,
    company,
    roleNotes,
    companyNotes,
    updates,
    findings,
    analysis,
    requests,
    intercept,
    rolePath,
    companyPath,
  };
}

it('collects every page through the real store with only scoped GETs and no read invalidation', async () => {
  const fixture = setup();
  await fixture.store.dispatch(
    postingApi.endpoints.posting.initiate(fixture.posting.id),
  );
  const result = await fixture.start();
  expect(result.error).toBeUndefined();
  expect(result.data).toMatchObject({
    posting: fixture.posting,
    stageId,
    source: { source: null },
    roleNotes: fixture.roleNotes,
    updates: fixture.updates,
    company: {
      details: fixture.company,
      notes: fixture.companyNotes,
      analysis: { ...fixture.analysis, items: fixture.findings },
    },
  });
  expect(result.data?.roleNotes).toHaveLength(21);
  expect(result.data?.company?.notes).toHaveLength(21);
  expect(result.data?.updates).toHaveLength(6);
  expect(result.data?.company?.analysis.items).toHaveLength(21);
  expect(result.data?.company?.analysis).not.toHaveProperty('nextCursor');
  expect(result.data?.startedAt).toMatch(/Z$/);
  expect(result.data?.completedAt).toMatch(/Z$/);
  expect(Date.parse(result.data?.completedAt ?? '')).toBeGreaterThanOrEqual(
    Date.parse(result.data?.startedAt ?? ''),
  );
  await Promise.all(
    fixture.store.dispatch(postingApi.util.getRunningQueriesThunk()),
  );
  expect(fixture.requests.every((request) => request.method === 'GET')).toBe(
    true,
  );
  expect(
    fixture.requests.filter(
      (request) => new URL(request.url).pathname === fixture.rolePath,
    ),
  ).toHaveLength(3);
  expect(fixture.requests).toHaveLength(13);
  for (const request of fixture.requests) {
    const url = new URL(request.url);
    expect(url.origin).toBe('http://localhost');
    expect(
      [fixture.rolePath, fixture.companyPath].some((prefix) =>
        url.pathname.startsWith(prefix),
      ),
    ).toBe(true);
    expect([...url.searchParams.keys()].every((key) => key === 'cursor')).toBe(
      true,
    );
    if (url.searchParams.has('cursor'))
      expect(url.searchParams.get('cursor')).toBe(nextCursor);
  }
});

it('starts independent sources concurrently while traversing each collection sequentially', async () => {
  const fixture = setup();
  const pending = Promise.withResolvers<Response>();
  fixture.intercept.mockImplementation((url) =>
    url.pathname === `${fixture.rolePath}/notes` &&
    !url.searchParams.has('cursor')
      ? pending.promise
      : undefined,
  );
  const request = fixture.start();
  await vi.waitFor(() => {
    expect(
      fixture.requests.some(
        (value) =>
          new URL(value.url).pathname === `${fixture.companyPath}/analysis`,
      ),
    ).toBe(true);
    expect(
      fixture.requests.some(
        (value) =>
          new URL(value.url).pathname === `${fixture.rolePath}/updates`,
      ),
    ).toBe(true);
  });
  expect(
    fixture.requests.filter(
      (value) => new URL(value.url).pathname === `${fixture.rolePath}/notes`,
    ),
  ).toHaveLength(1);
  pending.resolve(
    Response.json({
      schemaVersion: 1,
      items: fixture.roleNotes.slice(0, 20),
      nextCursor,
    }),
  );
  expect((await request).data?.roleNotes).toEqual(fixture.roleNotes);
});

it.each([
  'not-started',
  'disabled',
  'scheduled',
  'processing',
  'failed',
] as const)(
  'retains valid %s analysis without ensure, refresh, or other mutations',
  async (status) => {
    const fixture = setup();
    fixture.analysis.status = status;
    fixture.analysis.error =
      status === 'failed' ? 'Saved analysis failure' : null;
    if (status === 'not-started' || status === 'disabled') {
      fixture.findings.length = 0;
      fixture.analysis.completedAt = null;
      fixture.analysis.generation = null;
    }
    const result = await fixture.start();
    expect(result.error).toBeUndefined();
    expect(result.data?.company?.analysis).toEqual({
      ...fixture.analysis,
      items: fixture.findings,
    });
    expect(fixture.requests.every((request) => request.method === 'GET')).toBe(
      true,
    );
    expect(
      Object.keys(fixture.store.getState().postingApi.mutations),
    ).toHaveLength(0);
  },
);

it.each(['legacy', 'cleared'] as const)(
  'represents %s company absence and absent retained source without inferred company requests',
  async (kind) => {
    const fixture = setup();
    if (kind === 'legacy') delete fixture.posting.companyAssociation;
    else
      fixture.posting.companyAssociation = {
        company: null,
        mode: 'manual',
        revision: 2,
      };
    const result = await fixture.start();
    expect(result.error).toBeUndefined();
    expect(result.data?.company).toBeNull();
    expect(result.data?.source.source).toBeNull();
    expect(
      fixture.requests.every((request) => !request.url.includes('/companies')),
    ).toBe(true);
  },
);

it('retains the complete source envelope when page text was saved', async () => {
  const fixture = setup();
  const source = {
    text: 'Original code/email\n```html\n<div>Saved</div>\n```\n',
    sourceUrl: 'https://original.example/job',
    revision: uuid(902),
    updatedAt: timestamp,
  };
  fixture.intercept.mockImplementation((url) =>
    url.pathname.endsWith('/source-text')
      ? Response.json({
          schemaVersion: 1,
          source,
          applicationVersion: 4,
          generation: null,
        })
      : undefined,
  );
  expect((await fixture.start()).data?.source).toEqual({
    schemaVersion: 1,
    source,
    applicationVersion: 4,
    generation: null,
  });
});

it.each(['role notes', 'company notes', 'updates', 'analysis'] as const)(
  'follows an empty intermediate %s page without truncating the collection',
  async (collection) => {
    const fixture = setup();
    const path = {
      'role notes': `${fixture.rolePath}/notes`,
      'company notes': `${fixture.companyPath}/notes`,
      updates: `${fixture.rolePath}/updates`,
      analysis: `${fixture.companyPath}/analysis`,
    }[collection];
    fixture.intercept.mockImplementation((url) =>
      url.pathname === path && url.searchParams.get('cursor') === nextCursor
        ? Response.json({
            ...(collection === 'analysis'
              ? fixture.analysis
              : { schemaVersion: 1 }),
            items: [],
            nextCursor: 'after-empty',
          })
        : undefined,
    );
    const result = await fixture.start();
    expect(result.error).toBeUndefined();
    expect(result.data?.roleNotes).toEqual(fixture.roleNotes);
    expect(result.data?.updates).toEqual(fixture.updates);
    expect(result.data?.company?.notes).toEqual(fixture.companyNotes);
    expect(result.data?.company?.analysis.items).toEqual(fixture.findings);
    expect(
      fixture.requests.filter(
        (request) => new URL(request.url).pathname === path,
      ),
    ).toHaveLength(3);
  },
);

it.each(['notes', 'updates', 'analysis'] as const)(
  'fails repeated %s cursors rather than returning a truncated aggregate',
  async (collection) => {
    const fixture = setup();
    const path =
      collection === 'analysis'
        ? `${fixture.companyPath}/analysis`
        : `${fixture.rolePath}/${collection}`;
    fixture.intercept.mockImplementation((url) =>
      url.pathname === path && url.searchParams.has('cursor')
        ? Response.json({
            ...(collection === 'analysis'
              ? fixture.analysis
              : { schemaVersion: 1 }),
            items: [],
            nextCursor,
          })
        : undefined,
    );
    const result = await fixture.start();
    expect(result.data).toBeUndefined();
    expect(result.error).toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(
      fixture.requests.filter(
        (request) => new URL(request.url).pathname === path,
      ),
    ).toHaveLength(2);
  },
);

it('rejects a late failure safely and retries every collection from its first page', async () => {
  const fixture = setup();
  fixture.intercept.mockImplementation((url) =>
    url.pathname === `${fixture.companyPath}/analysis` &&
    url.searchParams.has('cursor')
      ? Response.json({ private: 'private upstream body' }, { status: 503 })
      : undefined,
  );
  const failed = await fixture.start();
  expect(failed.data).toBeUndefined();
  expect(failed.error).toEqual({
    status: 503,
    data: {
      message:
        'Could not load company analysis. No export was created. Try again.',
    },
  });
  const firstAttemptCount = fixture.requests.length;
  fixture.intercept.mockReset();
  const retry = await fixture.start();
  expect(retry.error).toBeUndefined();
  expect(retry.data?.roleNotes).toEqual(fixture.roleNotes);
  expect(retry.data?.company?.notes).toEqual(fixture.companyNotes);
  expect(retry.data?.updates).toEqual(fixture.updates);
  expect(retry.data?.company?.analysis.items).toEqual(fixture.findings);
  const retried = fixture.requests
    .slice(firstAttemptCount)
    .map((request) => new URL(request.url));
  expect(retried[0].pathname).toBe(fixture.rolePath);
  for (const path of [
    `${fixture.rolePath}/notes`,
    `${fixture.rolePath}/updates`,
    `${fixture.companyPath}/notes`,
    `${fixture.companyPath}/analysis`,
  ]) {
    expect(
      retried
        .filter((url) => url.pathname === path)
        .map((url) => url.searchParams.get('cursor')),
    ).toEqual([null, nextCursor]);
  }
});

const failureCases = [
  { name: 'missing role', target: 'role', status: 404, source: 'saved role' },
  {
    name: 'missing company',
    target: 'company',
    status: 404,
    source: 'associated company',
  },
  {
    name: 'missing source route',
    target: 'source-text',
    status: 404,
    source: 'retained page text',
  },
  {
    name: 'late role comments',
    target: 'notes',
    status: 503,
    source: 'role comments',
    late: true,
  },
  {
    name: 'late history',
    target: 'updates',
    status: 503,
    source: 'Update role history',
    late: true,
  },
  {
    name: 'late company comments',
    target: 'company-notes',
    status: 503,
    source: 'company comments',
    late: true,
  },
  {
    name: 'expired session',
    target: 'analysis',
    status: 401,
    source: 'company analysis',
  },
  {
    name: 'analysis conflict',
    target: 'analysis',
    status: 409,
    source: 'company analysis',
    late: true,
  },
];

it.each(failureCases)(
  'fails the complete export for $name while preserving safe HTTP status',
  async ({ target, status, source, late }) => {
    const fixture = setup();
    const path =
      target === 'role'
        ? fixture.rolePath
        : target === 'company'
          ? fixture.companyPath
          : target === 'company-notes'
            ? `${fixture.companyPath}/notes`
            : target === 'analysis'
              ? `${fixture.companyPath}/analysis`
              : `${fixture.rolePath}/${target}`;
    fixture.intercept.mockImplementation((url) =>
      url.pathname === path && (!late || url.searchParams.has('cursor'))
        ? Response.json(
            {
              code: 'ANALYSIS_CHANGED',
              private: 'Never expose this payload',
            },
            { status },
          )
        : undefined,
    );
    const result = await fixture.start();
    expect(result.data).toBeUndefined();
    expect(result.error).toEqual({
      status,
      data: {
        message:
          status === 401
            ? 'Your session expired. Sign in again to export prep materials.'
            : status === 409
              ? 'Saved context changed while exporting. Try again.'
              : `Could not load ${source}. No export was created. Try again.`,
      },
    });
  },
);

it.each([
  'role',
  'source-text',
  'notes',
  'updates',
  'company',
  'company-notes',
  'analysis',
] as const)(
  'validates the %s wire response and does not leak malformed bodies',
  async (target) => {
    const fixture = setup();
    const path =
      target === 'role'
        ? fixture.rolePath
        : target === 'company'
          ? fixture.companyPath
          : target === 'company-notes'
            ? `${fixture.companyPath}/notes`
            : target === 'analysis'
              ? `${fixture.companyPath}/analysis`
              : `${fixture.rolePath}/${target}`;
    fixture.intercept.mockImplementation((url) =>
      url.pathname === path
        ? Response.json({ private: 'Do not export unvalidated saved data' })
        : undefined,
    );
    const result = await fixture.start();
    expect(result.data).toBeUndefined();
    expect(result.error).toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(JSON.stringify(result.error)).not.toContain('private');
  },
);

it('sanitizes rejected transport exceptions', async () => {
  const fixture = setup();
  fixture.intercept.mockRejectedValue(new Error('private transport details'));
  const result = await fixture.start();
  expect(result.data).toBeUndefined();
  expect(result.error).toEqual({
    status: 'CUSTOM_ERROR',
    error: 'Could not load saved role. No export was created. Try again.',
  });
});

it.each(['missing process', 'removed stage'] as const)(
  'does not substitute a current stage when the target has a %s',
  async (kind) => {
    const fixture = setup();
    fixture.posting.application.interviewProcess =
      kind === 'missing process'
        ? null
        : {
            stages: [{ id: otherStageId, name: 'Screen' }],
            currentStageId: otherStageId,
          };
    const result = await fixture.start();
    expect(result.data).toBeUndefined();
    expect(result.error).toEqual({
      status: 'CUSTOM_ERROR',
      error:
        'This interview step is no longer available. Close and reopen the interview details.',
    });
    expect(fixture.requests).toHaveLength(1);
  },
);

it('rejects an analysis publication change even when HTTP pagination succeeds', async () => {
  const fixture = setup();
  fixture.intercept.mockImplementation((url) =>
    url.pathname === `${fixture.companyPath}/analysis` &&
    url.searchParams.has('cursor')
      ? Response.json({
          ...fixture.analysis,
          completedAt: null,
          items: [],
          nextCursor: null,
        })
      : undefined,
  );
  const result = await fixture.start();
  expect(result.data).toBeUndefined();
  expect(result.error).toEqual({
    status: 'CUSTOM_ERROR',
    error: 'Saved context changed while exporting. Try again.',
  });
});

it('retains first-page metadata without confusing processing generation with published results', async () => {
  const fixture = setup();
  fixture.intercept.mockImplementation((url) =>
    url.pathname === `${fixture.companyPath}/analysis` &&
    url.searchParams.has('cursor')
      ? Response.json({
          ...fixture.analysis,
          generation: uuid(903),
          status: 'processing',
          stale: true,
          items: fixture.findings.slice(20),
          nextCursor: null,
        })
      : undefined,
  );
  const result = await fixture.start();
  expect(result.error).toBeUndefined();
  expect(result.data?.company?.analysis).toEqual({
    ...fixture.analysis,
    items: fixture.findings,
  });
});

it('freshly rereads the role and rejects a changed version instead of exporting a different target', async () => {
  const fixture = setup();
  let reads = 0;
  fixture.intercept.mockImplementation((url) => {
    if (url.pathname !== fixture.rolePath) return undefined;
    reads++;
    if (reads === 2)
      return Response.json({
        schemaVersion: 1,
        item: {
          ...fixture.posting,
          recordVersion: fixture.posting.recordVersion + 1,
        },
      });
  });
  const result = await fixture.start();
  expect(reads).toBe(2);
  expect(result.data).toBeUndefined();
  expect(result.error).toEqual({
    status: 'CUSTOM_ERROR',
    error: 'Saved context changed while exporting. Try again.',
  });
});

it('aborts the real query signal and never starts another cursor request after cancellation', async () => {
  const fixture = setup();
  const pending = Promise.withResolvers<Response>();
  const entered = Promise.withResolvers<Request>();
  fixture.intercept.mockImplementation((url, request) => {
    if (url.pathname === `${fixture.rolePath}/notes`) {
      entered.resolve(request);
      return pending.promise;
    }
  });
  const query = fixture.start();
  const noteRequest = await entered.promise;
  query.abort();
  expect(noteRequest.signal.aborted).toBe(true);
  pending.resolve(
    Response.json({
      schemaVersion: 1,
      items: [],
      nextCursor: 'must-not-load',
    }),
  );
  const result = await query;
  expect(result.data).toBeUndefined();
  expect(result.error).toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() =>
    expect(
      fixture.store.getState().postingApi.queries[query.queryCacheKey]?.status,
    ).toBe('rejected'),
  );
  expect(
    fixture.requests.filter(
      (request) =>
        new URL(request.url).pathname === `${fixture.rolePath}/notes`,
    ),
  ).toHaveLength(1);
  expect(
    fixture.requests.some((request) => request.url.includes('must-not-load')),
  ).toBe(false);
});

it('rejects an already cancelled loader without making any read', async () => {
  const controller = new AbortController();
  controller.abort();
  const read = vi.fn();
  const result = await loadPrepContext(
    { roleId: uuid(1), stageId },
    read,
    controller.signal,
  );
  expect(result).toEqual({
    error: {
      status: 'CUSTOM_ERROR',
      error: 'Could not load saved role. No export was created. Try again.',
    },
  });
  expect(read).not.toHaveBeenCalled();
});

it('does not refetch on posting invalidation and removes unused export data immediately', async () => {
  const fixture = setup();
  const query = fixture.start();
  await query;
  const count = fixture.requests.length;
  fixture.store.dispatch(
    postingApi.util.invalidateTags(['Posting', 'Notes', 'Analysis']),
  );
  await Promise.all(
    fixture.store.dispatch(postingApi.util.getRunningQueriesThunk()),
  );
  expect(fixture.requests).toHaveLength(count);
  query.unsubscribe();
  await vi.waitFor(() =>
    expect(
      postingApi.endpoints.prepContext.select(fixture.args)(
        fixture.store.getState(),
      ).isUninitialized,
    ).toBe(true),
  );
});

it.each(['notes', 'updates', 'analysis'] as const)(
  'validates every %s page, including malformed later pages',
  async (collection) => {
    const fixture = setup();
    const path =
      collection === 'analysis'
        ? `${fixture.companyPath}/analysis`
        : `${fixture.rolePath}/${collection}`;
    fixture.intercept.mockImplementation((url) =>
      url.pathname === path && url.searchParams.has('cursor')
        ? Response.json({
            ...(collection === 'analysis'
              ? fixture.analysis
              : { schemaVersion: 1 }),
            items: [{ private: 'Malformed older saved data' }],
            nextCursor: null,
          })
        : undefined,
    );
    const result = await fixture.start();
    expect(result.data).toBeUndefined();
    expect(result.error).toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(JSON.stringify(result.error)).not.toContain('private');
  },
);

it('fails when the final required role reread fails', async () => {
  const fixture = setup();
  let reads = 0;
  fixture.intercept.mockImplementation((url) => {
    if (url.pathname !== fixture.rolePath) return undefined;
    reads++;
    if (reads === 2)
      return Response.json(
        { private: 'Deleted while reading' },
        { status: 404 },
      );
  });
  const result = await fixture.start();
  expect(reads).toBe(2);
  expect(result.data).toBeUndefined();
  expect(result.error).toEqual({
    status: 404,
    data: {
      message: 'Could not load saved role. No export was created. Try again.',
    },
  });
});

it('settles a cancelled loader without following an otherwise valid cursor', async () => {
  const fixture = setup();
  const controller = new AbortController();
  const read = vi.fn(async (request: string | { url: string }) => {
    const url = typeof request === 'string' ? request : request.url;
    if (url === `/${fixture.posting.id}`)
      return { data: { schemaVersion: 1, item: fixture.posting } };
    if (url.endsWith('/source-text'))
      return {
        data: {
          schemaVersion: 1,
          source: null,
          applicationVersion: fixture.posting.applicationVersion,
          generation: fixture.posting.extraction.generation,
        },
      };
    controller.abort();
    return {
      data: { schemaVersion: 1, items: [], nextCursor: 'must-not-load' },
    };
  });
  const result = await loadPrepContext(fixture.args, read, controller.signal);
  expect(result).toHaveProperty('error');
  expect(result).not.toHaveProperty('data');
  expect(read).toHaveBeenCalledTimes(3);
});
