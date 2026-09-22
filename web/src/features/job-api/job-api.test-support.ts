import { vi } from 'vitest';
import fixture from '../../../e2e/postings.fixture.json';
import {
  type RoleNote,
  type SavedPosting,
  savedPostingSchema,
} from './job-api.contracts';
export const postingFixtures = () =>
  fixture.map((item) => savedPostingSchema.parse(item));
export function mockPostingApi(initial = postingFixtures()) {
  const records = new Map(
    initial.map((item) => [item.id, structuredClone(item)]),
  );
  const notes = new Map<string, RoleNote[]>();
  const companyNotes = new Map<string, RoleNote[]>();
  const companies = new Set(
    initial.map((item) => item.companyAssociation?.company?.id).filter(Boolean),
  );
  const sources = new Map<
    string,
    { text: string; sourceUrl: string; revision: string; updatedAt: string }
  >();
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
      const companyScope = url.pathname.split('/')[3] === 'companies';
      const parts = url.pathname.split('/');
      const id = parts[companyScope ? 4 : 3];
      const json = (body: unknown, status = 200) =>
        Response.json(body, { status });
      if (url.pathname.endsWith('/source-guidance')) {
        const { hostname } = await request.json();
        return json({
          hostname,
          recommendSourceText: hostname === 'indeed.com',
        });
      }
      if (url.pathname.endsWith('/source-text')) {
        const item = records.get(id);
        return item
          ? json({
              schemaVersion: 1,
              source: sources.get(id) ?? null,
              applicationVersion: item.applicationVersion,
              generation: item.extraction.generation,
            })
          : json({}, 404);
      }
      if (parts[companyScope ? 5 : 4] === 'notes') {
        const role = records.get(id);
        if (companyScope ? !companies.has(id) : !role) return json({}, 404);
        const collection = companyScope ? companyNotes : notes;
        const list = collection.get(id) ?? [];
        collection.set(id, list);
        if (request.method === 'GET') {
          const after = Number(url.searchParams.get('cursor') ?? 0);
          return json({
            schemaVersion: 1,
            items: list.slice(after, after + 20),
            nextCursor: list.length > after + 20 ? String(after + 20) : null,
          });
        }
        const body = await request.json();
        const noteId = parts[companyScope ? 6 : 5] ?? body.id;
        const note = list.find((value) => value.id === noteId);
        if (request.method === 'POST') {
          if (note)
            return note.body === body.body
              ? json({ schemaVersion: 1, note })
              : json({}, 409);
          const created = {
            id: noteId,
            body: body.body,
            revision: 1,
            createdAt: '2026-09-22T12:00:00.000Z',
            updatedAt: '2026-09-22T12:00:00.000Z',
          };
          list.unshift(created);
          if (role && !companyScope) {
            role.applicationVersion++;
            role.recordVersion++;
          }
          return json({ schemaVersion: 1, note: created }, 201);
        }
        if (!note)
          return request.method === 'DELETE'
            ? new Response(null, { status: 204 })
            : json({}, 404);
        if (note.revision !== body.expectedRevision) return json({}, 409);
        if (role && !companyScope) {
          role.applicationVersion++;
          role.recordVersion++;
        }
        if (request.method === 'DELETE') {
          collection.set(
            id,
            list.filter((value) => value.id !== noteId),
          );
          return new Response(null, { status: 204 });
        }
        Object.assign(note, {
          body: body.body,
          revision: note.revision + 1,
          updatedAt: '2026-09-22T13:00:00.000Z',
        });
        return json({ schemaVersion: 1, note });
      }
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
        if (body.sourceText?.trim())
          sources.set(item.id, {
            text: body.sourceText,
            sourceUrl,
            revision: crypto.randomUUID(),
            updatedAt: item.updatedAt,
          });
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
      if (body.sourceText !== undefined) {
        if (body.expectedApplicationVersion !== item.applicationVersion)
          return json({}, 409);
        if (body.sourceText?.trim())
          sources.set(id, {
            text: body.sourceText,
            sourceUrl: item.sourceUrl,
            revision: crypto.randomUUID(),
            updatedAt: item.updatedAt,
          });
        else sources.delete(id);
        item.applicationVersion++;
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
  return { records, notes, companyNotes, companies, sources, fetcher };
}
