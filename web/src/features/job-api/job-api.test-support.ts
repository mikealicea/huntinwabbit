import { vi } from 'vitest';
import fixture from '../../../e2e/postings.fixture.json';
import { type SavedPosting, savedPostingSchema } from './job-api.contracts';
export const postingFixtures = () =>
  fixture.map((item) => savedPostingSchema.parse(item));
export function mockPostingApi(initial = postingFixtures()) {
  const records = new Map(
    initial.map((item) => [item.id, structuredClone(item)]),
  );
  let sequence = 100;
  const NativeRequest = globalThis.Request;
  vi.stubGlobal(
    'Request',
    class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === 'string' && input.startsWith('/')
            ? `http://localhost${input}`
            : input,
          init,
        );
      }
    },
  );
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const id = url.pathname.split('/')[3];
      const json = (body: unknown, status = 200) =>
        Response.json(body, { status });
      if (request.method === 'GET' && url.pathname.endsWith('/updates'))
        return records.has(id)
          ? json({ schemaVersion: 1, items: [], nextCursor: null })
          : json({}, 404);
      if (request.method === 'GET')
        return id
          ? records.has(id)
            ? json({ schemaVersion: 1, item: records.get(id) })
            : json({}, 404)
          : json({
              schemaVersion: 1,
              items: [...records.values()],
              nextCursor: null,
            });
      const body = await request.json();
      if (request.method === 'POST' && !id) {
        if (String(body.url).includes('fail.example')) return json({}, 503);
        const sourceUrl = new URL(
          body.url.startsWith('http') ? body.url : `https://${body.url}`,
        ).href;
        const existing = [...records.values()].find(
          (item) => item.sourceUrl === sourceUrl,
        );
        if (existing)
          return json({ schemaVersion: 1, item: existing, created: false });
        const item: SavedPosting = {
          id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
          sourceUrl,
          parsedPosting: null,
          application: {
            stage: 'collected',
            interest: body.application.interest,
            priority: 'not-set',
            followUpOn: null,
            notes: '',
          },
          applicationVersion: 0,
          recordVersion: 0,
          createdAt: '2026-09-21T00:00:00.000Z',
          updatedAt: '2026-09-21T00:00:00.000Z',
          extraction: { status: 'disabled', generation: null, error: null },
        };
        records.set(item.id, item);
        return json({ schemaVersion: 1, item, created: true }, 201);
      }
      const item = records.get(id);
      if (request.method === 'DELETE') {
        if (item && item.applicationVersion !== body.expectedApplicationVersion)
          return json({}, 409);
        records.delete(id);
        return new Response(null, { status: 204 });
      }
      if (!item) return json({}, 404);
      if (request.method === 'PATCH') {
        if (item.applicationVersion !== body.expectedApplicationVersion)
          return json({}, 409);
        const next = {
          ...item,
          application: { ...item.application, ...body.changes },
          applicationVersion: item.applicationVersion + 1,
          recordVersion: item.recordVersion + 1,
        };
        records.set(id, next);
        return json({ schemaVersion: 1, item: next });
      }
      const next: SavedPosting = {
        ...item,
        extraction: {
          status: 'queued',
          generation: '00000000-0000-4000-8000-999999999999',
          error: null,
        },
      };
      records.set(id, next);
      return json({ schemaVersion: 1, item: next }, 202);
    },
  );
  vi.stubGlobal('fetch', fetcher);
  return { records, fetcher };
}
