import { randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from './job-postings.dynamodb.ts';
import { parsedPostingFixture } from './job-postings.fixtures.ts';
import { saveRequestSchema } from './job-postings.schemas.ts';
import { createJobPostings } from './job-postings.service.ts';
import { memoryPostings } from './job-postings.test-support.ts';
import { effectiveFields } from './job-postings.updates.logic.ts';
import { createRoleUpdateParser } from './job-postings.updates.redpill.ts';
import type { ParseUpdates } from './job-postings.updates.schemas.ts';
import { createRoleUpdates } from './job-postings.updates.ts';
import { createExtractionWorker } from './job-postings.worker.ts';

const signal = () => AbortSignal.timeout(5000);
async function setup(override?: (send: DynamoTransport) => DynamoTransport) {
  const db = memoryPostings();
  const send = override ? override(db.send) : db.send;
  const postings = createJobPostings(
    createDynamoPostingStore('test', send),
    () => '2026-09-21T00:00:00.000Z',
    undefined,
    true,
  );
  const item = (
    await postings.save(
      'alice',
      saveRequestSchema.parse({
        url: 'https://example.com/job',
        parsedPosting: {
          ...parsedPostingFixture(),
          source: {
            normalizedUrl: 'https://example.com/job',
            fetchedAt: '2026-09-21T00:00:00.000Z',
          },
        },
      }),
      signal(),
    )
  ).item;
  let now = Date.parse('2026-09-22T02:00:00.000Z');
  const updates = createRoleUpdates('test', send, true, undefined, () => now++);
  const input = (text = 'Make this role remote and high priority') => ({
    operationId: randomUUID(),
    text,
    timezone: 'America/New_York',
  });
  const get = () => postings.get('alice', item.id, signal());
  const history = () => updates.history('alice', item.id, {});
  const run = async (parse: ParseUpdates) => {
    const current = await get();
    if (!current.edits?.pending) throw new Error('No pending update');
    await createRoleUpdates('test', send, true, parse, () => now++).run(
      'USER#alice',
      current.edits.pending,
    );
  };
  return { ...db, send, postings, item, updates, input, get, history, run };
}
describe('natural language role updates', () => {
  it('persists accepted work, applies multiple fields, keeps history and undoes atomically', async () => {
    const s = await setup();
    const message = s.input();
    const entry = await s.updates.submit('alice', s.item.id, message);
    expect(entry.status).toBe('queued');
    const parse = vi.fn<ParseUpdates>(async (input) => {
      expect(input.today).toBe('2026-09-21');
      expect(input.current.title).toBe(s.item.parsedPosting?.job.title);
      return {
        changes: [
          { field: 'workArrangement', value: 'remote' },
          { field: 'priority', value: 'high' },
          { field: 'notes', value: 'Recruiter confirmed the location.' },
        ],
        skipped: [],
      };
    });
    await s.run(parse);
    expect(effectiveFields(await s.get())).toMatchObject({
      workArrangement: 'remote',
      priority: 'high',
      notes: 'Recruiter confirmed the location.',
    });
    const history = await s.history();
    expect(history.items[0]).toMatchObject({
      status: 'applied',
      text: message.text,
    });
    expect(history.items[0]?.changes).toHaveLength(3);
    await s.updates.undo('alice', s.item.id, entry.id);
    expect(effectiveFields(await s.get())).toEqual(effectiveFields(s.item));
    expect((await s.history()).items[0]?.undoneAt).not.toBeNull();
    await s.updates.undo('alice', s.item.id, entry.id);
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it('applies clear parts, ignores invalid fields and preserves omitted facts', async () => {
    const s = await setup();
    await s.updates.submit('alice', s.item.id, s.input());
    await s.run(async () => ({
      changes: [
        { field: 'priority', value: 'high' },
        { field: 'closingDate', value: 'tomorrow-ish' },
      ],
      skipped: ['The salary range is ambiguous.'],
    }));
    expect((await s.history()).items[0]).toMatchObject({
      status: 'partial',
      skipped: [
        'The salary range is ambiguous.',
        'closingDate: could not interpret a valid value.',
      ],
    });
    const next = await s.get();
    expect(next.application.priority).toBe('high');
    expect(next.parsedPosting).toEqual(s.item.parsedPosting);
  });
  it('preserves corrections and explicit clears during refresh; undo reveals the latest extracted value', async () => {
    const s = await setup();
    const entry = await s.updates.submit(
      'alice',
      s.item.id,
      s.input(
        'Clear location and technologies, and update title and description',
      ),
    );
    await s.run(async () => ({
      changes: [
        { field: 'locations', value: [] },
        { field: 'title', value: 'Corrected title' },
        { field: 'technologies', value: [] },
        {
          field: 'description',
          value: '## Corrected overview\n\nKeep my wording.',
        },
      ],
      skipped: [],
    }));
    const refreshed = await s.postings.extract(
      'alice',
      s.item.id,
      null,
      signal(),
    );
    const replacement = structuredClone(s.item.parsedPosting);
    if (!replacement) throw new Error();
    replacement.job.title = 'New extracted title';
    replacement.job.locations = ['Boston'];
    replacement.job.technologies = ['TypeScript (required)'];
    replacement.job.description = '## New overview\n\nNew posting wording.';
    await createExtractionWorker('test', s.send, async () => replacement).run(
      'USER#alice',
      `JOB#${refreshed.extraction.generation}`,
    );
    expect(effectiveFields(await s.get())).toMatchObject({
      title: 'Corrected title',
      locations: [],
      technologies: [],
      description: '## Corrected overview\n\nKeep my wording.',
    });
    await s.updates.undo('alice', s.item.id, entry.id);
    expect(effectiveFields(await s.get())).toMatchObject({
      title: 'New extracted title',
      locations: ['Boston'],
      technologies: ['TypeScript (required)'],
      description: '## New overview\n\nNew posting wording.',
    });
  });
  it('rejects overwrite after intervening changes including changes away and back', async () => {
    const s = await setup();
    const entry = await s.updates.submit('alice', s.item.id, s.input());
    await s.run(async () => ({
      changes: [{ field: 'priority', value: 'high' }],
      skipped: [],
    }));
    for (const priority of ['low', 'high'] as const) {
      const current = await s.get();
      await s.postings.update(
        'alice',
        s.item.id,
        {
          expectedApplicationVersion: current.applicationVersion,
          changes: { priority },
        },
        signal(),
      );
    }
    await expect(
      s.updates.undo('alice', s.item.id, entry.id),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await s.get()).application.priority).toBe('high');
  });
  it('skips fields changed while inference is running while applying independent changes', async () => {
    const s = await setup();
    await s.updates.submit('alice', s.item.id, s.input());
    await s.run(async () => {
      await s.postings.update(
        'alice',
        s.item.id,
        { expectedApplicationVersion: 0, changes: { notes: 'Newer notes' } },
        signal(),
      );
      return {
        changes: [
          { field: 'notes', value: 'Stale notes' },
          { field: 'priority', value: 'high' },
        ],
        skipped: [],
      };
    });
    expect((await s.get()).application).toMatchObject({
      notes: 'Newer notes',
      priority: 'high',
    });
    expect((await s.history()).items[0]?.status).toBe('partial');
  });
  it('does not duplicate paid work on repeated submissions or stream delivery', async () => {
    const s = await setup();
    const input = s.input();
    const entry = await s.updates.submit('alice', s.item.id, input);
    expect(await s.updates.submit('alice', s.item.id, input)).toEqual(entry);
    await expect(
      s.updates.submit('alice', s.item.id, { ...input, text: 'Different' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      s.updates.submit('alice', s.item.id, s.input()),
    ).rejects.toMatchObject({ statusCode: 409 });
    const key = (await s.get()).edits?.pending;
    if (!key) throw new Error();
    const parse = vi.fn<ParseUpdates>(async () => ({
      changes: [],
      skipped: ['No supported update.'],
    }));
    const worker = createRoleUpdates('test', s.send, true, parse);
    await Promise.all([
      worker.run('USER#alice', key),
      worker.run('USER#alice', key),
    ]);
    await worker.run('USER#alice', key);
    expect(parse).toHaveBeenCalledTimes(1);
    expect((await s.history()).items[0]?.status).toBe('unchanged');
  });
  it.each(['queued', 'processing'] as const)(
    'recovers %s work without automatically retrying inference',
    async (state) => {
      let lose = false;
      const s = await setup((send) => async (command, signal) => {
        const result = await send(command, signal);
        if (
          lose &&
          command instanceof TransactWriteCommand &&
          command.input.TransactItems?.some(
            (x) => x.Put?.Item?.status === 'processing',
          )
        ) {
          lose = false;
          throw new Error('Lost claim');
        }
        return result;
      });
      const first = s.input();
      await s.updates.submit('alice', s.item.id, first);
      const parse = vi.fn<ParseUpdates>();
      if (state === 'processing') {
        lose = true;
        await s.run(parse);
      }
      const pending = (await s.get()).edits?.pending;
      if (!pending) throw new Error();
      await createRoleUpdates('test', s.send, true, parse, () =>
        Date.parse('2026-09-23T00:00:00Z'),
      ).recover('USER#alice', pending);
      expect(parse).not.toHaveBeenCalled();
      expect((await s.history()).items[0]?.status).toBe('failed');
      await s.updates.submit('alice', s.item.id, {
        ...s.input(first.text),
        retryOf: first.operationId,
      });
      expect((await s.history()).items[0]?.retryOf).toBe(first.operationId);
    },
  );
  it('keeps fields unchanged on provider failure and reports a safe failure', async () => {
    const s = await setup();
    await s.updates.submit('alice', s.item.id, s.input());
    await s.run(async () => {
      throw new Error('secret payload');
    });
    expect(effectiveFields(await s.get())).toEqual(effectiveFields(s.item));
    expect(JSON.stringify(await s.history())).not.toContain('secret payload');
    expect((await s.history()).items[0]?.status).toBe('failed');
  });
  it('changes source identity atomically and fences an older extraction', async () => {
    const s = await setup();
    const refresh = await s.postings.extract(
      'alice',
      s.item.id,
      null,
      signal(),
    );
    await s.updates.submit(
      'alice',
      s.item.id,
      s.input('Use https://example.com/new'),
    );
    await s.run(async () => ({
      changes: [{ field: 'sourceUrl', value: 'https://example.com/new' }],
      skipped: [],
    }));
    expect((await s.get()).sourceUrl).toBe('https://example.com/new');
    expect((await s.get()).extraction).toMatchObject({
      generation: null,
      status: 'not-requested',
    });
    const parse = vi.fn();
    await createExtractionWorker('test', s.send, parse).run(
      'USER#alice',
      `JOB#${refresh.extraction.generation}`,
    );
    expect(parse).not.toHaveBeenCalled();
    const duplicate = await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://example.com/new' }),
      signal(),
    );
    expect(duplicate.item.id).toBe(s.item.id);
    const reused = await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://example.com/job' }),
      signal(),
    );
    expect(reused.created).toBe(true);
    await expect(
      s.updates.undo(
        'alice',
        s.item.id,
        (await s.history()).items[0]?.id ?? '',
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('skips duplicate source URLs while applying other changes', async () => {
    const s = await setup();
    await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://example.com/other' }),
      signal(),
    );
    await s.updates.submit('alice', s.item.id, s.input());
    await s.run(async () => ({
      changes: [
        { field: 'sourceUrl', value: 'https://example.com/other' },
        { field: 'priority', value: 'high' },
      ],
      skipped: [],
    }));
    expect((await s.get()).sourceUrl).toBe(s.item.sourceUrl);
    expect((await s.get()).application.priority).toBe('high');
  });
  it('does not resurrect deleted roles, cleans history and isolates users and reused URLs', async () => {
    const s = await setup();
    await s.updates.submit('alice', s.item.id, s.input());
    await expect(s.updates.history('bob', s.item.id, {})).rejects.toMatchObject(
      { statusCode: 404 },
    );
    await s.run(async () => {
      await s.postings.delete('alice', s.item.id, 0, signal());
      return { changes: [{ field: 'priority', value: 'high' }], skipped: [] };
    });
    await createExtractionWorker('test', s.send, undefined).recover();
    expect(s.rows.size).toBe(0);
    const replacement = await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: s.item.sourceUrl }),
      signal(),
    );
    expect(
      (await s.updates.history('alice', replacement.item.id, {})).items,
    ).toEqual([]);
  });
  it('paginates conversation history and rejects cross-owner cursors', async () => {
    const s = await setup();
    for (let i = 0; i < 7; i++) {
      await s.updates.submit('alice', s.item.id, s.input(`Message ${i}`));
      await s.run(async () => ({ changes: [], skipped: [] }));
    }
    const first = await s.history();
    expect(first.items).toHaveLength(5);
    const second = await s.updates.history('alice', s.item.id, {
      cursor: first.nextCursor ?? '',
    });
    expect(second.items).toHaveLength(2);
    const bad = Buffer.from(
      JSON.stringify({
        pk: 'USER#bob',
        sk: `JOB#UPDATE#${s.item.id}#anything`,
      }),
    ).toString('base64url');
    await expect(
      s.updates.history('alice', s.item.id, { cursor: bad }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('guards HTTP contracts and exposes status/history through authenticated routes', async () => {
    const s = await setup();
    const app = buildApp({
      verifyAccessToken: async (userId) => ({ userId }),
      jobPostings: s.postings,
      roleUpdates: s.updates,
    });
    const path = `/job-postings/${s.item.id}/updates`;
    expect((await request(app).post(path).send(s.input())).status).toBe(401);
    expect(
      (
        await request(app)
          .post(path)
          .auth('bob', { type: 'bearer' })
          .send(s.input())
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path)
          .auth('alice', { type: 'bearer' })
          .send({ ...s.input(), timezone: 'invalid' })
      ).status,
    ).toBe(400);
    const result = await request(app)
      .post(path)
      .auth('alice', { type: 'bearer' })
      .send(s.input());
    expect(result.status).toBe(202);
    expect(
      (await request(app).get(path).auth('alice', { type: 'bearer' })).body
        .items[0].status,
    ).toBe('queued');
  });
});
it('uses a bounded, schema-validated Redpill completion without questions or tools', async () => {
  const s = await setup();
  const fetcher = vi.fn(async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    expect(body.messages[0].content).toContain('Never ask questions');
    expect(body.tools).toBeUndefined();
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              changes: [{ field: 'priority', value: 'high' }],
              skipped: [],
            }),
          },
        },
      ],
    });
  });
  const parse = createRoleUpdateParser('test-key', { fetch: fetcher });
  expect(
    (
      await parse(
        {
          text: 'Make high priority',
          current: effectiveFields(s.item),
          history: [],
          today: '2026-09-21',
        },
        signal(),
      )
    ).changes,
  ).toHaveLength(1);
  fetcher.mockResolvedValueOnce(
    Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: '{"changes":[{"field":"id","value":"bad"}],"skipped":[]}',
          },
        },
      ],
    }),
  );
  await expect(
    parse(
      {
        text: 'x',
        current: effectiveFields(s.item),
        history: [],
        today: '2026-09-21',
      },
      signal(),
    ),
  ).rejects.toThrow();
});

it('recovers lost submission, completion and Undo acknowledgements without duplicate changes', async () => {
  let lose = false;
  const s = await setup((send) => async (command, signal) => {
    const result = await send(command, signal);
    if (lose && command instanceof TransactWriteCommand) {
      lose = false;
      throw new Error('Lost reply');
    }
    return result;
  });
  const input = s.input();
  lose = true;
  const entry = await s.updates.submit('alice', s.item.id, input);
  await s.run(async () => {
    lose = true;
    return { changes: [{ field: 'priority', value: 'low' }], skipped: [] };
  });
  expect((await s.history()).items).toHaveLength(1);
  expect((await s.get()).application.priority).toBe('low');
  lose = true;
  await s.updates.undo('alice', s.item.id, entry.id);
  expect((await s.get()).application.priority).toBe(
    s.item.application.priority,
  );
  expect((await s.history()).items[0]?.undoneAt).not.toBeNull();
});
it('supports unextracted roles, partial salary units, notes and list replacement values', async () => {
  const s = await setup();
  const empty = await s.postings.save(
    'alice',
    saveRequestSchema.parse({ url: 'https://example.com/unextracted' }),
    signal(),
  );
  await s.updates.submit(
    'alice',
    empty.item.id,
    s.input('Salary is 150k; notes from recruiter; benefits include leave'),
  );
  const queued = await s.postings.get('alice', empty.item.id, signal());
  if (!queued.edits?.pending) throw new Error();
  await createRoleUpdates('test', s.send, true, async () => ({
    changes: [
      {
        field: 'compensation',
        value: [
          {
            minimum: 150000,
            maximum: 150000,
            currency: null,
            period: null,
            kind: null,
            location: null,
            originalText: '150k',
          },
        ],
      },
      { field: 'notes', value: 'Recruiter notes' },
      { field: 'benefits', value: ['Paid leave'] },
    ],
    skipped: [],
  })).run('USER#alice', queued.edits.pending);
  const updated = await s.postings.get('alice', empty.item.id, signal());
  expect(updated.parsedPosting).toBeNull();
  expect(effectiveFields(updated)).toMatchObject({
    compensation: [
      { minimum: 150000, maximum: 150000, currency: null, period: null },
    ],
    notes: 'Recruiter notes',
    benefits: ['Paid leave'],
  });
});
it('dispatches update jobs and recovery through the deployed worker and ignores pointer events', async () => {
  const s = await setup();
  const entry = await s.updates.submit('alice', s.item.id, s.input());
  const key = (await s.get()).edits?.pending;
  if (!key) throw new Error();
  const parse = vi.fn<ParseUpdates>(async () => ({
    changes: [{ field: 'priority', value: 'low' }],
    skipped: [],
  }));
  const worker = createExtractionWorker(
    'test',
    s.send,
    undefined,
    Date.now,
    parse,
  );
  await worker.run('USER#alice', `JOB#UPDATE-ID#${s.item.id}#${entry.id}`);
  expect(parse).not.toHaveBeenCalled();
  await worker.run('USER#alice', key);
  expect(parse).toHaveBeenCalledTimes(1);
  await s.updates.submit('alice', s.item.id, s.input());
  await createExtractionWorker(
    'test',
    s.send,
    undefined,
    () => Date.parse('2026-09-24T00:00:00Z'),
    parse,
  ).recover();
  expect((await s.history()).items[0]?.status).toBe('failed');
  expect(parse).toHaveBeenCalledTimes(1);
});
