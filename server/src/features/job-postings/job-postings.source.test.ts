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
import {
  extractionRequestSchema,
  saveRequestSchema,
  sourceTextSchema,
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
  const send = override?.(db.send) ?? db.send;
  const service = createJobPostings(
    createDynamoPostingStore('test', send),
    undefined,
    undefined,
    enabled,
  );
  const parse = vi.fn(async () => parsedPostingFixture());
  const worker = createExtractionWorker('test', send, parse);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    jobPostings: service,
  });
  const save = (
    sourceText = 'Fictional engineer role. Build software.',
    extract = true,
  ) =>
    service.save(
      'alice',
      saveRequestSchema.parse({
        url: parsedPostingFixture().source.normalizedUrl,
        extract,
        sourceText,
      }),
      signal(),
    );
  return { ...db, send, service, parse, worker, app, save };
}
function change(
  sourceText: string | null,
  expectedGeneration: string | null = null,
  expectedApplicationVersion = 0,
) {
  return extractionRequestSchema.parse({
    sourceText,
    expectedGeneration,
    expectedApplicationVersion,
    operationId: randomUUID(),
  });
}
describe('retained source text', () => {
  it('saves separately, preserves duplicates and excludes text from listing; extraction reuses it', async () => {
    const s = setup();
    const { item } = await s.save();
    const again = await s.save('Do not overwrite the existing source');
    expect(again.created).toBe(false);
    expect(
      (await s.service.sourceText('alice', item.id, signal())).source?.text,
    ).toBe('Fictional engineer role. Build software.');
    expect(
      JSON.stringify(await s.service.list('alice', { limit: 20 }, signal())),
    ).not.toContain('Fictional engineer role');
    await Promise.all([
      s.worker.run('USER#alice', `JOB#${item.extraction.generation}`),
      s.worker.run('USER#alice', `JOB#${item.extraction.generation}`),
    ]);
    expect(s.parse).toHaveBeenCalledTimes(1);
    expect(s.parse.mock.calls[0]).toEqual([
      item.sourceUrl,
      expect.any(AbortSignal),
      undefined,
      'Fictional engineer role. Build software.',
    ]);
    const next = await s.service.extract(
      'alice',
      item.id,
      item.extraction.generation,
      signal(),
    );
    await s.worker.run('USER#alice', `JOB#${next.extraction.generation}`);
    expect(s.parse).toHaveBeenCalledTimes(2);
    expect(s.parse.mock.calls[1]).toEqual([
      item.sourceUrl,
      expect.any(AbortSignal),
      undefined,
      'Fictional engineer role. Build software.',
    ]);
  });
  it('applies replacement atomically and replays the same operation without another job, including after completion', async () => {
    const s = setup();
    const { item } = await s.save('', false);
    const input = change('Updated fictional job');
    const next = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      input,
    );
    expect(next.applicationVersion).toBe(1);
    expect(
      await s.service.extract('alice', item.id, null, signal(), input),
    ).toEqual(next);
    await expect(
      s.service.extract('alice', item.id, null, signal(), {
        ...input,
        sourceText: 'Different',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      s.service.extract(
        'alice',
        item.id,
        next.extraction.generation,
        signal(),
        change('Competing', next.extraction.generation, 1),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await s.worker.run('USER#alice', `JOB#${next.extraction.generation}`);
    const replay = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      input,
    );
    expect(replay.extraction.status).toBe('complete');
    expect(replay.extraction.generation).toBe(next.extraction.generation);
    expect(s.parse).toHaveBeenCalledTimes(1);
    await s.worker.run(
      'USER#alice',
      `JOB#SOURCE-ID#${item.id}#${input.operationId}`,
    );
    expect(s.parse).toHaveBeenCalledTimes(1);
    const removed = await s.service.extract(
      'alice',
      item.id,
      next.extraction.generation,
      signal(),
      change(null, next.extraction.generation, 1),
    );
    expect(
      (await s.service.sourceText('alice', item.id, signal())).source,
    ).toBeNull();
    await s.worker.run('USER#alice', `JOB#${removed.extraction.generation}`);
    expect(s.parse.mock.calls[1]).toEqual([
      item.sourceUrl,
      expect.any(AbortSignal),
      undefined,
      undefined,
    ]);
  });
  it('recovers an accepted source mutation after a lost acknowledgement', async () => {
    let fail = false;
    const s = setup(true, (send) => async (command, abort) => {
      const result = await send(command, abort);
      if (fail && command instanceof TransactWriteCommand) {
        fail = false;
        throw new Error('Lost response');
      }
      return result;
    });
    const { item } = await s.save('', false);
    fail = true;
    const next = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      change('Retained after uncertain response'),
    );
    expect(next.extraction.status).toBe('queued');
    expect(
      (await s.service.sourceText('alice', item.id, signal())).source?.text,
    ).toBe('Retained after uncertain response');
  });
  it('retains and removes source text with parsing disabled', async () => {
    const s = setup(false);
    const { item } = await s.save();
    expect(item.extraction.status).toBe('disabled');
    const updated = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      change('Replacement'),
    );
    expect(updated.extraction.status).toBe('disabled');
    await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      change(null, null, 1),
    );
    expect(
      (await s.service.sourceText('alice', item.id, signal())).source,
    ).toBeNull();
    expect(s.parse).not.toHaveBeenCalled();
  });
  it('rejects stale edits and source URL mismatches without publishing paid work', async () => {
    const s = setup();
    const { item } = await s.save('Original', false);
    await s.service.update(
      'alice',
      item.id,
      { expectedApplicationVersion: 0, changes: { priority: 'high' } },
      signal(),
    );
    await expect(
      s.service.extract('alice', item.id, null, signal(), change('Stale')),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const source = s.rows.get(`USER#alice|SOURCE#${item.id}`);
    if (!source) throw new Error();
    source.sourceUrl = 'https://example.test/old-job';
    await expect(
      s.service.extract('alice', item.id, null, signal()),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(s.parse).not.toHaveBeenCalled();
    const next = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      change('For current URL', null, 1),
    );
    expect(next.extraction.status).toBe('queued');
  });
  it('fences changed revisions and removes source and receipts on deletion without resurrection', async () => {
    const s = setup();
    const { item } = await s.save('', false);
    const next = await s.service.extract(
      'alice',
      item.id,
      null,
      signal(),
      change('Source to remove'),
    );
    const source = s.rows.get(`USER#alice|SOURCE#${item.id}`);
    if (!source) throw new Error();
    source.revision = randomUUID();
    await s.worker.run('USER#alice', `JOB#${next.extraction.generation}`);
    expect(s.parse).not.toHaveBeenCalled();
    expect(
      (await s.service.get('alice', item.id, signal())).extraction.status,
    ).toBe('failed');
    await s.service.delete('alice', item.id, 1, signal());
    expect(s.rows.has(`USER#alice|SOURCE#${item.id}`)).toBe(false);
    await expect(
      s.service.sourceText('alice', item.id, signal()),
    ).rejects.toMatchObject({ statusCode: 404 });
    await s.worker.recover();
    expect(
      [...s.rows.values()].some((row) =>
        String(row.sk).startsWith('JOB#SOURCE-ID#'),
      ),
    ).toBe(false);
    await s.worker.run('USER#alice', `JOB#${next.extraction.generation}`);
    expect(s.parse).not.toHaveBeenCalled();
  });
  it('enforces auth, owner isolation, bounded inputs and explicit versioned extraction contracts', async () => {
    const s = setup();
    const { item } = await s.save('Saved', false);
    const path = `/job-postings/${item.id}/source-text`;
    expect((await request(s.app).get(path)).status).toBe(401);
    expect(
      (await request(s.app).get(path).auth('bob', { type: 'bearer' })).status,
    ).toBe(404);
    expect(
      (await request(s.app).get(path).auth('alice', { type: 'bearer' })).body
        .source.text,
    ).toBe('Saved');
    expect(sourceTextSchema.safeParse('x'.repeat(100_001)).success).toBe(false);
    expect(sourceTextSchema.safeParse('漢'.repeat(90_000)).success).toBe(false);
    expect(
      extractionRequestSchema.safeParse({
        expectedGeneration: null,
        sourceText: 'Unversioned',
      }).success,
    ).toBe(false);
    const response = await request(s.app)
      .post(`/job-postings/${item.id}/extraction`)
      .auth('alice', { type: 'bearer' })
      .send(change('x'.repeat(99_999)));
    expect(response.status).toBe(202);
    expect(
      (await s.service.sourceText('alice', item.id, signal())).source?.text
        .length,
    ).toBe(99_999);
  });
});
