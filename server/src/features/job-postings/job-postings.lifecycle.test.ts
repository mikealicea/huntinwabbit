import { readFile } from 'node:fs/promises';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from './job-postings.dynamodb.ts';
import { parsedPostingFixture } from './job-postings.fixtures.ts';
import {
  savedPostingSchema,
  saveRequestSchema,
} from './job-postings.schemas.ts';
import { createJobPostings } from './job-postings.service.ts';
import { memoryPostings } from './job-postings.test-support.ts';
import { createExtractionWorker } from './job-postings.worker.ts';

const signal = () => AbortSignal.timeout(5000);
function setup(
  enabled = true,
  override?: (send: DynamoTransport) => DynamoTransport,
) {
  const db = memoryPostings();
  const send = override ? override(db.send) : db.send;
  const store = createDynamoPostingStore('test', send);
  const service = createJobPostings(store, undefined, undefined, enabled);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    jobPostings: service,
  });
  const save = (extract = true) =>
    service.save(
      'alice',
      saveRequestSchema.parse({
        url: parsedPostingFixture().source.normalizedUrl,
        extract,
      }),
      signal(),
    );
  return { ...db, send, store, service, app, save };
}
afterEach(() => vi.restoreAllMocks());
describe('persistent edits and extraction', () => {
  it('atomically saves lookup pointers and durable jobs; duplicate saves do not publish again', async () => {
    const s = setup();
    const first = await s.save();
    const again = await s.save();
    expect(first.item.extraction.status).toBe('queued');
    expect(again.item).toEqual(first.item);
    expect(s.rows.size).toBe(4);
    expect(await s.service.get('alice', first.item.id, signal())).toEqual(
      first.item,
    );
    await expect(
      s.service.get('bob', first.item.id, signal()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('keeps link capture available when extraction is disabled', async () => {
    const s = setup(false);
    const { item } = await s.save();
    expect(item.extraction.status).toBe('disabled');
    expect(s.rows.size).toBe(3);
    await expect(
      s.service.extract('alice', item.id, null, signal()),
    ).rejects.toMatchObject({ code: 'PARSING_DISABLED' });
  });
  it('persists independent edits and rejects stale versions without overwriting', async () => {
    const s = setup();
    const { item } = await s.save(false);
    const updated = await s.service.update(
      'alice',
      item.id,
      {
        expectedApplicationVersion: 0,
        changes: { notes: 'Fictional notes', stage: 'applied' },
      },
      signal(),
    );
    expect(updated.applicationVersion).toBe(1);
    expect(updated.application.interest).toBe('not-set');
    await expect(
      s.service.update(
        'alice',
        item.id,
        { expectedApplicationVersion: 0, changes: { priority: 'high' } },
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(
      (await s.service.get('alice', item.id, signal())).application.notes,
    ).toBe('Fictional notes');
  });
  it('recovers a lost update acknowledgement', async () => {
    let fail = false;
    const s = setup(true, (send) => async (command, abort) => {
      const result = await send(command, abort);
      if (fail && command instanceof TransactWriteCommand) {
        fail = false;
        throw new Error('Lost acknowledgement');
      }
      return result;
    });
    const { item } = await s.save(false);
    fail = true;
    expect(
      (
        await s.service.update(
          'alice',
          item.id,
          { expectedApplicationVersion: 0, changes: { stage: 'offer' } },
          signal(),
        )
      ).applicationVersion,
    ).toBe(1);
  });
  it('runs once on concurrent duplicate delivery and preserves edits made during parsing', async () => {
    const s = setup();
    const { item } = await s.save();
    const parse = vi.fn(async () => {
      await s.service.update(
        'alice',
        item.id,
        {
          expectedApplicationVersion: 0,
          changes: { notes: 'Keep my note', priority: 'high' },
        },
        signal(),
      );
      return parsedPostingFixture();
    });
    const worker = createExtractionWorker('test', s.send, parse);
    await Promise.all([
      worker.run('USER#alice', `JOB#${item.extraction.generation}`),
      worker.run('USER#alice', `JOB#${item.extraction.generation}`),
    ]);
    await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
    expect(parse).toHaveBeenCalledTimes(1);
    const final = await s.service.get('alice', item.id, signal());
    expect(final.extraction.status).toBe('complete');
    expect(final.parsedPosting).toEqual(parsedPostingFixture());
    expect(final.application.notes).toBe('Keep my note');
    expect(final.applicationVersion).toBe(1);
  });
  it('persists failures without dropping links and permits one explicitly requested generation', async () => {
    const s = setup();
    const { item } = await s.save();
    const parse = vi.fn(async () => {
      throw new Error('private provider error');
    });
    await createExtractionWorker('test', s.send, parse).run(
      'USER#alice',
      `JOB#${item.extraction.generation}`,
    );
    const failed = await s.service.get('alice', item.id, signal());
    expect(failed.extraction).toMatchObject({
      status: 'failed',
      error: 'EXTRACTION_FAILED',
    });
    const retry = await s.service.extract(
      'alice',
      item.id,
      item.extraction.generation,
      signal(),
    );
    expect(retry.extraction.generation).not.toBe(item.extraction.generation);
    expect(
      (
        await s.service.extract(
          'alice',
          item.id,
          item.extraction.generation,
          signal(),
        )
      ).extraction.generation,
    ).toBe(retry.extraction.generation);
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it('recovers expired queued work without making a paid call', async () => {
    const s = setup();
    const { item } = await s.save();
    const parse = vi.fn();
    await createExtractionWorker(
      'test',
      s.send,
      parse,
      () => Date.now() + 16 * 60_000,
    ).recover();
    expect(
      (await s.service.get('alice', item.id, signal())).extraction.error,
    ).toBe('EXTRACTION_DELAYED');
    expect(parse).not.toHaveBeenCalled();
  });
  it('does not repeat inference after an uncertain claim; recovery terminates it', async () => {
    let loseClaim = true;
    const s = setup(true, (send) => async (command, abort) => {
      const result = await send(command, abort);
      if (
        loseClaim &&
        command instanceof TransactWriteCommand &&
        command.input.TransactItems?.some(
          (entry) => entry.Put?.Item?.status === 'processing',
        )
      ) {
        loseClaim = false;
        throw new Error('Lost claim reply');
      }
      return result;
    });
    const { item } = await s.save();
    const parse = vi.fn();
    const worker = createExtractionWorker('test', s.send, parse);
    await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
    expect(parse).not.toHaveBeenCalled();
    await createExtractionWorker(
      'test',
      s.send,
      parse,
      () => Date.now() + 4 * 60_000,
    ).recover();
    expect(
      (await s.service.get('alice', item.id, signal())).extraction.error,
    ).toBe('EXTRACTION_INTERRUPTED');
  });
  it('rejects stale worker output after recovery and a new generation', async () => {
    const s = setup();
    const { item } = await s.save();
    const worker = createExtractionWorker('test', s.send, async () => {
      await createExtractionWorker(
        'test',
        s.send,
        undefined,
        () => Date.now() + 4 * 60_000,
      ).recover();
      await s.service.extract(
        'alice',
        item.id,
        item.extraction.generation,
        signal(),
      );
      return parsedPostingFixture();
    });
    await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
    const current = await s.service.get('alice', item.id, signal());
    expect(current.parsedPosting).toBeNull();
    expect(current.extraction.status).toBe('queued');
  });
  it('guards HTTP input, ownership, and update version', async () => {
    const s = setup();
    const { item } = await s.save(false);
    expect((await request(s.app).get(`/job-postings/${item.id}`)).status).toBe(
      401,
    );
    expect(
      (
        await request(s.app)
          .get(`/job-postings/${item.id}`)
          .auth('bob', { type: 'bearer' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(s.app)
          .get('/job-postings/invalid')
          .auth('alice', { type: 'bearer' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(s.app)
          .patch(`/job-postings/${item.id}`)
          .auth('alice', { type: 'bearer' })
          .send({ changes: { notes: 'x' } })
      ).status,
    ).toBe(400);
    const response = await request(s.app)
      .patch(`/job-postings/${item.id}`)
      .auth('alice', { type: 'bearer' })
      .send({
        expectedApplicationVersion: 0,
        changes: { followUpOn: '2026-10-01' },
      });
    expect(response.status).toBe(200);
    expect(response.body.item.application.followUpOn).toBe('2026-10-01');
    expect(
      (
        await request(s.app)
          .post(`/job-postings/${item.id}/extraction`)
          .auth('alice', { type: 'bearer' })
          .send({ expectedGeneration: null })
      ).status,
    ).toBe(202);
  });
});

it('accepts the frontend fixture against the actual public response contract', async () => {
  const data: unknown = JSON.parse(
    await readFile(
      new URL('../../../../web/e2e/postings.fixture.json', import.meta.url),
      'utf8',
    ),
  );
  expect(Array.isArray(data)).toBe(true);
  if (!Array.isArray(data)) throw new Error('Invalid fixture');
  for (const item of data)
    expect(savedPostingSchema.safeParse(item).success).toBe(true);
});

it('refreshes completed facts while preserving the last good result and tracking', async () => {
  const s = setup();
  const { item } = await s.save();
  const worker = createExtractionWorker('test', s.send, async () =>
    parsedPostingFixture(),
  );
  await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
  const current = await s.service.get('alice', item.id, signal());
  const refreshed = await s.service.extract(
    'alice',
    item.id,
    current.extraction.generation,
    signal(),
  );
  expect(refreshed.extraction.status).toBe('queued');
  expect(refreshed.parsedPosting).toEqual(current.parsedPosting);
  expect(refreshed.application).toEqual(current.application);
});

it('keeps old facts on failed refresh and replaces them after a retry, without replacing edits', async () => {
  const s = setup();
  const { item } = await s.save();
  await createExtractionWorker('test', s.send, async () =>
    parsedPostingFixture(),
  ).run('USER#alice', `JOB#${item.extraction.generation}`);
  const refresh = await s.service.extract(
    'alice',
    item.id,
    item.extraction.generation,
    signal(),
  );
  await createExtractionWorker('test', s.send, async () => {
    throw new Error('failed');
  }).run('USER#alice', `JOB#${refresh.extraction.generation}`);
  expect(
    (await s.service.get('alice', item.id, signal())).parsedPosting,
  ).toEqual(parsedPostingFixture());
  await expect(
    s.service.extract('alice', item.id, item.extraction.generation, signal()),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  const retry = await s.service.extract(
    'alice',
    item.id,
    refresh.extraction.generation,
    signal(),
  );
  const replacement = parsedPostingFixture();
  replacement.job.title = 'Updated title';
  await createExtractionWorker('test', s.send, async () => {
    await s.service.update(
      'alice',
      item.id,
      {
        expectedApplicationVersion: 0,
        changes: { notes: 'Keep', stage: 'offer' },
      },
      signal(),
    );
    return replacement;
  }).run('USER#alice', `JOB#${retry.extraction.generation}`);
  const result = await s.service.get('alice', item.id, signal());
  expect(result.parsedPosting).toEqual(replacement);
  expect(result.application).toMatchObject({ notes: 'Keep', stage: 'offer' });
});

it('deletes atomically, guards tracking versions, is ownership-safe and releases the URL', async () => {
  const s = setup();
  const { item } = await s.save();
  await s.service.delete('bob', item.id, 0, signal());
  expect(await s.service.get('alice', item.id, signal())).toEqual(item);
  await s.service.update(
    'alice',
    item.id,
    { expectedApplicationVersion: 0, changes: { notes: 'New note' } },
    signal(),
  );
  await expect(
    s.service.delete('alice', item.id, 0, signal()),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await s.service.delete('alice', item.id, 1, signal());
  expect([...s.rows.values()].map((row) => row.sk)).toEqual([
    `DELETE#${item.id}`,
  ]);
  await s.service.delete('alice', item.id, 1, signal());
  await expect(s.service.get('alice', item.id, signal())).rejects.toMatchObject(
    { code: 'NOT_FOUND' },
  );
  expect(
    (await s.service.list('alice', { limit: 20 }, signal())).items,
  ).toEqual([]);
  const again = await s.save();
  expect(again.created).toBe(true);
  expect(again.item.id).not.toBe(item.id);
  await createExtractionWorker('test', s.send, undefined).recover();
  expect(await s.service.get('alice', again.item.id, signal())).toEqual(
    again.item,
  );
});

it.each([false, true])(
  'does not resurrect a posting deleted during extraction (provider failure: %s)',
  async (fail) => {
    const s = setup();
    const { item } = await s.save();
    const parse = vi.fn(async () => {
      await s.service.delete('alice', item.id, 0, signal());
      if (fail) throw new Error('Provider failed after deletion');
      return parsedPostingFixture();
    });
    const worker = createExtractionWorker('test', s.send, parse);
    await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
    await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
    await worker.recover();
    expect(parse).toHaveBeenCalledTimes(1);
    expect(s.rows.size).toBe(0);
  },
);

it('skips queued work deleted before delivery', async () => {
  const s = setup();
  const { item } = await s.save();
  await s.service.delete('alice', item.id, 0, signal());
  const parse = vi.fn();
  await createExtractionWorker('test', s.send, parse).run(
    'USER#alice',
    `JOB#${item.extraction.generation}`,
  );
  expect(parse).not.toHaveBeenCalled();
});

it('recovers a lost deletion acknowledgement and rebases over concurrent extraction', async () => {
  let intercept: (() => Promise<void>) | undefined;
  let lose = false;
  const s = setup(true, (send) => async (command, abort) => {
    if (
      command instanceof TransactWriteCommand &&
      command.input.TransactItems?.some((entry) => entry.Delete)
    ) {
      const action = intercept;
      intercept = undefined;
      if (action) await action();
      const result = await send(command, abort);
      if (lose) {
        lose = false;
        throw new Error('Lost reply');
      }
      return result;
    }
    return send(command, abort);
  });
  const { item } = await s.save();
  intercept = () =>
    createExtractionWorker('test', s.send, async () =>
      parsedPostingFixture(),
    ).run('USER#alice', `JOB#${item.extraction.generation}`);
  lose = true;
  await s.service.delete('alice', item.id, 0, signal());
  expect([...s.rows.values()].map((row) => row.sk)).toEqual([
    `DELETE#${item.id}`,
  ]);
});

it('cleans historical job pages durably and leaves other postings intact', async () => {
  const s = setup();
  const { item } = await s.save();
  const originalJob = s.rows.get(
    `USER#alice|JOB#${item.extraction.generation}`,
  );
  for (let i = 0; i < 105; i++) {
    const generation = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    s.rows.set(`USER#alice|JOB#${generation}`, {
      ...originalJob,
      sk: `JOB#${generation}`,
      generation,
      status: 'complete',
      dueGroup: undefined,
    });
  }
  await s.service.delete('alice', item.id, 0, signal());
  const again = await s.save();
  const now = Date.now();
  const worker = createExtractionWorker('test', s.send, undefined, () => now);
  await Promise.all([worker.recover(), worker.recover()]);
  const marker = s.rows.get(`USER#alice|DELETE#${item.id}`);
  expect(marker).toMatchObject({ revision: 1 });
  expect(marker?.cursor).toBeDefined();
  for (let tick = 1; tick <= 3; tick++)
    await createExtractionWorker(
      'test',
      s.send,
      undefined,
      () => now + tick * 60_000,
    ).recover();
  expect(s.rows.has(`USER#alice|DELETE#${item.id}`)).toBe(false);
  expect(
    [...s.rows.values()].filter((row) => String(row.sk).startsWith('JOB#')),
  ).toHaveLength(1);
  expect(await s.service.get('alice', again.item.id, signal())).toEqual(
    again.item,
  );
});

it('validates deletion HTTP input and handles empty success responses', async () => {
  const s = setup();
  const { item } = await s.save(false);
  const url = `/job-postings/${item.id}`;
  expect(
    (await request(s.app).delete(url).send({ expectedApplicationVersion: 0 }))
      .status,
  ).toBe(401);
  expect(
    (
      await request(s.app)
        .delete(url)
        .auth('alice', { type: 'bearer' })
        .send({})
    ).status,
  ).toBe(400);
  expect(
    (
      await request(s.app)
        .delete(url)
        .auth('alice', { type: 'bearer' })
        .send({ expectedApplicationVersion: 1 })
    ).status,
  ).toBe(409);
  const result = await request(s.app)
    .delete(url)
    .auth('alice', { type: 'bearer' })
    .send({ expectedApplicationVersion: 0 });
  expect(result.status).toBe(204);
  expect(result.text).toBe('');
});

it('retries interrupted cleanup without losing its cursor or unrelated records', async () => {
  let fail = false;
  const s = setup(true, (send) => async (command, abort) => {
    if (
      fail &&
      command instanceof TransactWriteCommand &&
      command.input.TransactItems?.some((entry) =>
        String(entry.Delete?.Key?.sk ?? entry.Put?.Item?.sk).startsWith(
          'DELETE#',
        ),
      )
    ) {
      fail = false;
      throw new Error('Storage unavailable');
    }
    return send(command, abort);
  });
  const { item } = await s.save();
  const worker = createExtractionWorker('test', s.send, async () =>
    parsedPostingFixture(),
  );
  await worker.run('USER#alice', `JOB#${item.extraction.generation}`);
  await s.service.extract(
    'alice',
    item.id,
    item.extraction.generation,
    signal(),
  );
  await s.service.delete('alice', item.id, 0, signal());
  fail = true;
  await expect(worker.recover()).rejects.toThrow('Storage unavailable');
  expect(s.rows.has(`USER#alice|JOB#${item.extraction.generation}`)).toBe(true);
  expect(s.rows.get(`USER#alice|DELETE#${item.id}`)).toMatchObject({
    revision: 0,
  });
  await worker.recover();
  expect(s.rows.size).toBe(0);
});

it('does not spend when deletion wins a claim transaction', async () => {
  let beforeClaim: (() => Promise<void>) | undefined;
  const s = setup(true, (send) => async (command, abort) => {
    if (
      command instanceof TransactWriteCommand &&
      command.input.TransactItems?.some(
        (entry) => entry.Put?.Item?.status === 'processing',
      )
    ) {
      const action = beforeClaim;
      beforeClaim = undefined;
      if (action) await action();
    }
    return send(command, abort);
  });
  const { item } = await s.save();
  beforeClaim = () => s.service.delete('alice', item.id, 0, signal());
  const parse = vi.fn();
  await createExtractionWorker('test', s.send, parse).run(
    'USER#alice',
    `JOB#${item.extraction.generation}`,
  );
  expect(parse).not.toHaveBeenCalled();
});
