import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { makeStore } from '@/state/state.store';
import { createApiBridge } from './job-api.bridge';
import { postingApi } from './job-api.client';
import { mockPostingApi, postingFixtures } from './job-api.test-support';

const company = {
  id: '00000000-0000-4000-8000-000000000050',
  name: 'Northstar',
  website: null,
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
};
afterEach(() => vi.unstubAllGlobals());
it('bridges company reads and versioned selection through the authenticated allowlist', async () => {
  const http = vi.fn<typeof fetch>();
  const bridge = createApiBridge({
    origin: 'https://api.example.test',
    appOrigin: 'http://localhost',
    session: async () => ({
      status: 'authenticated',
      accessToken: 'fictional',
    }),
    fetch: http,
  });
  const request = (path: string, method = 'GET', body?: unknown) =>
    new Request(`http://localhost/api/job-postings${path}`, {
      method,
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  for (const [path, response] of [
    ['/companies', { schemaVersion: 1, items: [company], nextCursor: null }],
    [`/companies/${company.id}`, { schemaVersion: 1, item: company }],
    [
      `/companies/${company.id}/roles`,
      { schemaVersion: 1, items: postingFixtures(), nextCursor: null },
    ],
  ] as const) {
    http.mockResolvedValueOnce(Response.json(response));
    expect((await bridge(request(path))).status).toBe(200);
    expect(http.mock.calls.at(-1)?.[0]).toBe(`https://api.example.test${path}`);
  }
  const role = postingFixtures()[0];
  http.mockResolvedValueOnce(Response.json({ schemaVersion: 1, item: role }));
  expect(
    (
      await bridge(
        request(`/${role.id}/company`, 'PATCH', {
          expectedRecordVersion: 0,
          selection: null,
        }),
      )
    ).status,
  ).toBe(200);
  expect((await bridge(request('/companies', 'POST', {}))).status).toBe(405);
  expect((await bridge(request('/companies?cursor=a&cursor=b'))).status).toBe(
    400,
  );
  expect((await bridge(request('/companies/not-an-id'))).status).toBe(404);
  expect(
    (await bridge(request(`/${role.id}/company`, 'POST', {}))).status,
  ).toBe(405);
});
it('loads company details, paginated searches and roles and invalidates after selection', async () => {
  const boundary = mockPostingApi();
  const native = boundary.fetcher.getMockImplementation();
  const role = postingFixtures()[0];
  let requests = 0;
  boundary.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname.endsWith('/company'))
      return Response.json({ schemaVersion: 1, item: role });
    if (url.pathname.includes('/companies')) {
      requests++;
      if (url.pathname.endsWith(company.id))
        return Response.json({ schemaVersion: 1, item: company });
      return Response.json({
        schemaVersion: 1,
        items: url.pathname.endsWith('/roles') ? [role] : [company],
        nextCursor: url.searchParams.has('cursor') ? null : 'next',
      });
    }
    if (!native) throw new Error('Missing HTTP boundary');
    return native(req);
  });
  const store = makeStore();
  expect(
    (await store.dispatch(postingApi.endpoints.company.initiate(company.id)))
      .data,
  ).toEqual(company);
  for (const search of ['', 'North']) {
    await store.dispatch(postingApi.endpoints.companies.initiate(search));
    const result = await store.dispatch(
      postingApi.endpoints.companies.initiate(search, { direction: 'forward' }),
    );
    expect(result.data?.pages).toHaveLength(2);
  }
  await store.dispatch(postingApi.endpoints.companyRoles.initiate(company.id));
  const second = await store.dispatch(
    postingApi.endpoints.companyRoles.initiate(company.id, {
      direction: 'forward',
    }),
  );
  expect(second.data?.pages).toHaveLength(2);
  const before = requests;
  await store
    .dispatch(
      postingApi.endpoints.selectCompany.initiate({
        id: role.id,
        expectedRecordVersion: 0,
        selection: { id: company.id },
      }),
    )
    .unwrap();
  expect(requests).toBeGreaterThan(before);
  await store
    .dispatch(
      postingApi.endpoints.deletePosting.initiate({
        id: role.id,
        expectedApplicationVersion: role.applicationVersion,
      }),
    )
    .unwrap();
  store.dispatch(postingApi.util.resetApiState());
});

it('bridges company comment CRUD with bounded validation and origin protection', async () => {
  const http = vi.fn<typeof fetch>();
  const bridge = createApiBridge({
    origin: 'https://api.example.test',
    appOrigin: 'http://localhost',
    session: async () => ({
      status: 'authenticated',
      accessToken: 'fictional',
    }),
    fetch: http,
  });
  const id = '00000000-0000-4000-8000-000000000070';
  const path = `/companies/${company.id}/notes`;
  const note = {
    id,
    body: 'Fictional note',
    revision: 1,
    createdAt: company.createdAt,
    updatedAt: company.createdAt,
  };
  const req = (
    suffix: string,
    method = 'GET',
    body?: unknown,
    origin = 'http://localhost',
  ) =>
    new Request(`http://localhost/api/job-postings${suffix}`, {
      method,
      headers: { origin, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  for (const [method, suffix, body, response] of [
    [
      'GET',
      path,
      undefined,
      Response.json({ schemaVersion: 1, items: [note], nextCursor: null }),
    ],
    [
      'POST',
      path,
      { id, body: note.body },
      Response.json({ schemaVersion: 1, note }, { status: 201 }),
    ],
    [
      'PATCH',
      `${path}/${id}`,
      { body: note.body, expectedRevision: 1 },
      Response.json({ schemaVersion: 1, note }),
    ],
    [
      'DELETE',
      `${path}/${id}`,
      { expectedRevision: 1 },
      new Response(null, { status: 204 }),
    ],
  ] as const) {
    http.mockResolvedValueOnce(response);
    expect((await bridge(req(suffix, method, body))).status).toBe(
      response.status,
    );
    expect(http.mock.calls.at(-1)?.[0]).toBe(
      `https://api.example.test${suffix}`,
    );
  }
  const calls = http.mock.calls.length;
  expect((await bridge(req(path, 'POST', { id, body: ' ' }))).status).toBe(400);
  expect(
    (
      await bridge(
        req(path, 'POST', { id, body: note.body }, 'https://foreign.example'),
      )
    ).status,
  ).toBe(403);
  expect((await bridge(req(`${path}/${id}`, 'GET'))).status).toBe(405);
  expect((await bridge(req(`${path}?cursor=a&cursor=b`))).status).toBe(400);
  expect((await bridge(req(`${path}/not-a-uuid`, 'PATCH', {}))).status).toBe(
    404,
  );
  expect(http).toHaveBeenCalledTimes(calls);
});
