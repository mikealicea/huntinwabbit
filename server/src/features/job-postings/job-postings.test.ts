import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.ts';
import { unauthorized } from '../../shared/shared.errors.ts';
import { jobPostingsTable } from './job-postings.config.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from './job-postings.dynamodb.ts';
import { parsedPostingFixture } from './job-postings.fixtures.ts';
import { saveRequestSchema } from './job-postings.schemas.ts';
import { createJobPostings } from './job-postings.service.ts';

// Deterministic in-memory implementation of the three AWS operations, never a runtime fallback.
function database() {
  const rows = new Map<string, Record<string, unknown>>();
  const key = (pk: unknown, sk: unknown) => `${pk}|${sk}`;
  const send = vi.fn<DynamoTransport>(async (command) => {
    expect(
      command instanceof TransactWriteCommand
        ? command.input.TransactItems?.[0]?.Put?.TableName
        : command.input.TableName,
    ).toBe('test-postings');
    if (command instanceof GetCommand) {
      expect(command.input.ConsistentRead).toBe(true);
      return {
        Item: rows.get(key(command.input.Key?.pk, command.input.Key?.sk)),
      };
    }
    if (command instanceof TransactWriteCommand) {
      const puts = command.input.TransactItems?.map((entry) => entry.Put) ?? [];
      expect(puts.length).toBeGreaterThanOrEqual(3);
      expect(command.input.ClientRequestToken).toBeTruthy();
      for (const put of puts) {
        expect(put?.ConditionExpression).toBe('attribute_not_exists(pk)');
        if (rows.has(key(put?.Item?.pk, put?.Item?.sk)))
          throw new Error('conditional conflict');
      }
      for (const put of puts) {
        if (put?.Item)
          rows.set(key(put.Item.pk, put.Item.sk), structuredClone(put.Item));
      }
      return {};
    }
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input.ConsistentRead).toBe(true);
    expect(command.input.ScanIndexForward).toBe(false);
    expect(command.input.KeyConditionExpression).toBe(
      'pk = :owner AND begins_with(sk, :prefix)',
    );
    const values = command.input.ExpressionAttributeValues;
    const all = [...rows.values()]
      .filter(
        (row) =>
          row.pk === values?.[':owner'] &&
          String(row.sk).startsWith(String(values?.[':prefix'])) &&
          (!command.input.ExclusiveStartKey ||
            String(row.sk) < String(command.input.ExclusiveStartKey.sk)),
      )
      .sort((a, b) => String(b.sk).localeCompare(String(a.sk)));
    const Items = all.slice(0, command.input.Limit);
    const last = Items.at(-1);
    return {
      Items,
      ...(all.length > Items.length && last
        ? { LastEvaluatedKey: { pk: last.pk, sk: last.sk } }
        : {}),
    };
  });
  return { rows, send };
}
function setup() {
  const db = database();
  const service = createJobPostings(
    createDynamoPostingStore('test-postings', db.send),
  );
  const app = buildApp({
    verifyAccessToken: async (token) => {
      if (!['alice', 'bob'].includes(token))
        throw unauthorized('Invalid credentials.');
      return { userId: token };
    },
    jobPostings: service,
  });
  const save = (url: string, user = 'alice', extra = {}) =>
    request(app)
      .post('/job-postings')
      .auth(user, { type: 'bearer' })
      .send({ url, ...extra });
  const list = (query = '', user = 'alice') =>
    request(app).get(`/job-postings${query}`).auth(user, { type: 'bearer' });
  return { ...db, app, save, list, service };
}
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('saved job postings HTTP contract', () => {
  it('requires authentication before reading input or accessing storage', async () => {
    const { app, send } = setup();
    expect((await request(app).get('/job-postings')).status).toBe(401);
    expect(
      (await request(app).post('/job-postings').type('json').send('{')).status,
    ).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
  it('returns an honest empty collection and explicitly disables missing storage', async () => {
    const { list } = setup();
    const response = await list();
    expect(response.body).toEqual({
      schemaVersion: 1,
      items: [],
      nextCursor: null,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    const app = buildApp({
      verifyAccessToken: async () => ({ userId: 'alice' }),
    });
    expect(
      (
        await request(app)
          .get('/job-postings')
          .auth('alice', { type: 'bearer' })
      ).body.code,
    ).toBe('STORAGE_DISABLED');
    expect(
      (
        await request(app)
          .post('/job-postings')
          .auth('alice', { type: 'bearer' })
          .send({ url: 'example.test' })
      ).status,
    ).toBe(503);
  });
  it('saves normalized links with defaults, returns existing records unchanged, and isolates users', async () => {
    const { save, list } = setup();
    const first = await save('  example.test/job#section ');
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    expect(first.body.item).toMatchObject({
      sourceUrl: 'https://example.test/job',
      parsedPosting: null,
      application: {
        stage: 'collected',
        interest: 'not-set',
        priority: 'not-set',
        followUpOn: null,
        notes: '',
      },
    });
    expect(first.body.item).not.toHaveProperty('pk');
    const repeat = await save('https://example.test/job', 'alice', {
      application: { stage: 'offer', notes: 'do not replace' },
    });
    expect(repeat.status).toBe(200);
    expect(repeat.body).toEqual({ ...first.body, created: false });
    expect((await list('', 'bob')).body.items).toEqual([]);
    const bob = await save('example.test/job', 'bob');
    expect(bob.status).toBe(201);
    expect(bob.body.item.id).not.toBe(first.body.item.id);
    expect((await list()).body.items).toEqual([first.body.item]);
  });
  it('preserves valid tracking choices independently', async () => {
    const { save } = setup();
    const application = {
      stage: 'interviewing',
      interest: 'throwaway',
      priority: 'high',
      followUpOn: '2026-10-02',
      notes: 'Private fictional note',
    };
    expect(
      (await save('www.example.test/job?jk=123', 'alice', { application })).body
        .item.application,
    ).toEqual(application);
  });
  it('paginates full records in descending saved order without leaking another owner', async () => {
    const { service, list } = setup();
    for (const url of ['example.test/1', 'example.test/2', 'example.test/3'])
      await service.save(
        'alice',
        saveRequestSchema.parse({ url }),
        new AbortController().signal,
      );
    const all = (await list()).body.items;
    expect(
      all.map(
        (item: { createdAt: string; id: string }) => item.createdAt + item.id,
      ),
    ).toEqual(
      all
        .map(
          (item: { createdAt: string; id: string }) => item.createdAt + item.id,
        )
        .sort()
        .reverse(),
    );
    const first = (await list('?limit=2')).body;
    expect(first.items).toEqual(all.slice(0, 2));
    const second = (await list(`?limit=2&cursor=${first.nextCursor}`)).body;
    expect(second.items).toEqual(all.slice(2));
    expect(second.nextCursor).toBeNull();
    expect((await list(`?cursor=${first.nextCursor}`, 'bob')).body.code).toBe(
      'INVALID_CURSOR',
    );
  });
  it.each([
    '?limit=0',
    '?limit=51',
    '?limit=1.5',
    '?limit=01',
    '?limit=2&limit=3',
    '?userId=bob',
    '?cursor=',
    '?cursor[after]=x',
  ])('rejects invalid query %s', async (query) => {
    expect((await setup().list(query)).status).toBe(400);
  });
  it('rejects malformed cursors before database access', async () => {
    const { list, send } = setup();
    expect((await list('?cursor=garbage')).body.code).toBe('INVALID_CURSOR');
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    { url: 'ftp://example.test' },
    { url: 'example.test', userId: 'bob' },
    { url: 'example.test', application: { stage: 'invalid' } },
    { url: 'example.test', application: { followUpOn: '2026-02-30' } },
    { url: 'example.test', parsedPosting: {} },
  ])('rejects invalid save input', async (body) => {
    const { app, send } = setup();
    expect(
      (
        await request(app)
          .post('/job-postings')
          .auth('alice', { type: 'bearer' })
          .send(body)
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('handles malformed JSON, media types and route-specific body limits', async () => {
    const { app, save } = setup();
    expect(
      (
        await request(app)
          .post('/job-postings')
          .auth('alice', { type: 'bearer' })
          .type('json')
          .send('{')
      ).body.code,
    ).toBe('INVALID_JSON');
    expect(
      (
        await request(app)
          .post('/job-postings')
          .auth('alice', { type: 'bearer' })
          .type('text')
          .send('hello')
      ).status,
    ).toBe(415);
    expect(
      (
        await save('example.test', 'alice', {
          application: { notes: 'x'.repeat(18_000) },
        })
      ).status,
    ).toBe(201);
    expect(
      (await save('example.test', 'alice', { padding: 'x'.repeat(1_050_000) }))
        .status,
    ).toBe(413);
    expect(
      (
        await request(app)
          .post('/job-postings/parse')
          .auth('alice', { type: 'bearer' })
          .send({ url: 'x'.repeat(18_000) })
      ).status,
    ).toBe(413);
  });
  it('hides database errors and sensitive data from logs', async () => {
    const { send, list, save } = setup();
    await save('example.test/private-url', 'alice', {
      application: { notes: 'sensitive-note' },
    });
    send.mockRejectedValueOnce(new Error('provider-secret'));
    const response = await list();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('STORAGE_UNAVAILABLE');
    const logs = JSON.stringify([
      vi.mocked(console.log).mock.calls,
      vi.mocked(console.error).mock.calls,
      response.body,
    ]);
    for (const secret of [
      'private-url',
      'sensitive-note',
      'alice',
      'provider-secret',
    ])
      expect(logs).not.toContain(secret);
  });
});

describe('parsed posting storage', () => {
  it('round-trips full parsed facts without flattening compensation or missing values', async () => {
    const { save, list } = setup();
    const parsedPosting = parsedPostingFixture();
    const result = await save('example.test/job', 'alice', { parsedPosting });
    expect(result.status).toBe(201);
    expect(result.body.item.parsedPosting).toEqual(parsedPosting);
    expect((await list()).body.items[0].parsedPosting).toEqual(parsedPosting);
  });
  it('rejects a parse result for a different URL before storage', async () => {
    const { save, send } = setup();
    expect(
      (
        await save('example.test/other', 'alice', {
          parsedPosting: parsedPostingFixture(),
        })
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects oversized UTF-8 records after validation without silently dropping details', async () => {
    const { service, send } = setup();
    const parsedPosting = parsedPostingFixture();
    parsedPosting.job.description = '漢'.repeat(60_000);
    parsedPosting.job.requirements = Array.from({ length: 20 }, () =>
      '漢'.repeat(4_000),
    );
    const input = saveRequestSchema.parse({
      url: 'example.test/job',
      parsedPosting,
    });
    await expect(
      service.save('alice', input, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'POSTING_TOO_LARGE' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('DynamoDB failure and concurrency boundaries', () => {
  it('creates one record for simultaneous saves of the same URL', async () => {
    const { save, rows } = setup();
    const responses = await Promise.all([
      save('example.test/job'),
      save('example.test/job'),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(responses[0]?.body.item).toEqual(responses[1]?.body.item);
    expect(rows.size).toBe(3);
  });
  it('recovers a committed write with a lost acknowledgement', async () => {
    const db = database();
    const transport: DynamoTransport = async (command, signal) => {
      const response = await db.send(command, signal);
      if (command instanceof TransactWriteCommand)
        throw new Error('lost acknowledgement');
      return response;
    };
    const service = createJobPostings(
      createDynamoPostingStore('test-postings', transport),
    );
    const result = await service.save(
      'alice',
      saveRequestSchema.parse({ url: 'example.test' }),
      new AbortController().signal,
    );
    expect(result.created).toBe(false);
    expect(db.rows.size).toBe(3);
  });
  it('bounds hung storage and rejects work started after cancellation', async () => {
    vi.useFakeTimers();
    const send = vi.fn<DynamoTransport>(() => new Promise(() => {}));
    const store = createDynamoPostingStore('test-postings', send);
    const controller = new AbortController();
    const result = store.list('alice', { limit: 20 }, controller.signal);
    const check = expect(result).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    controller.abort();
    await check;
    await expect(
      store.list('alice', { limit: 20 }, controller.signal),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each([
    'invalid-json',
    'missing-field',
    'wrong-owner',
    'wrong-key',
    'wrong-url',
  ])('fails corrupt stored records: %s', async (corruption) => {
    const { save, rows, list } = setup();
    await save('example.test/job');
    const row = [...rows.values()].find((item) => 'data' in item);
    if (!row) throw new Error('missing fixture');
    if (corruption === 'invalid-json') row.data = '{';
    else if (corruption === 'wrong-owner') {
      // A malicious adapter result must not be trusted even after an owner-scoped query.
      const send: DynamoTransport = async () => ({
        Items: [{ ...row, pk: 'USER#bob' }],
      });
      await expect(
        createDynamoPostingStore('test-postings', send).list(
          'alice',
          { limit: 20 },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_STORED_POSTING' });
      return;
    } else {
      const data = JSON.parse(String(row.data));
      if (corruption === 'missing-field') delete data.application.stage;
      if (corruption === 'wrong-key')
        data.id = '00000000-0000-4000-8000-000000000000';
      if (corruption === 'wrong-url') data.sourceUrl = 'ftp://example.test/job';
      row.data = JSON.stringify(data);
    }
    expect((await list()).body.code).toBe('INVALID_STORED_POSTING');
  });
  it('does not mistake a hash collision or broken pointer for a duplicate', async () => {
    const { save, rows } = setup();
    await save('example.test/job');
    const row = [...rows.values()].find((item) => 'data' in item);
    if (!row) throw new Error('missing fixture');
    const data = JSON.parse(String(row.data));
    data.sourceUrl = 'https://different.test/job';
    row.data = JSON.stringify(data);
    expect((await save('example.test/job')).body.code).toBe(
      'INVALID_STORED_POSTING',
    );
    rows.delete(
      [...rows.entries()].find(([, value]) => value === row)?.[0] ?? '',
    );
    expect((await save('example.test/job')).status).toBe(500);
  });
  it('returns a retryable failure when a transaction fails without committing', async () => {
    const db = database();
    const transport: DynamoTransport = async (command, signal) => {
      if (command instanceof TransactWriteCommand)
        throw new Error('capacity unavailable');
      return db.send(command, signal);
    };
    const service = createJobPostings(
      createDynamoPostingStore('test-postings', transport),
    );
    await expect(
      service.save(
        'alice',
        saveRequestSchema.parse({ url: 'example.test' }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(db.rows.size).toBe(0);
  });
  it('a caller can retry safely after a timed-out write that committed', async () => {
    const db = database();
    const controller = new AbortController();
    const transport: DynamoTransport = async (command, signal) => {
      const result = await db.send(command, signal);
      if (command instanceof TransactWriteCommand) {
        controller.abort();
        throw new Error('lost acknowledgement');
      }
      return result;
    };
    const service = createJobPostings(
      createDynamoPostingStore('test-postings', transport),
    );
    const input = saveRequestSchema.parse({ url: 'example.test' });
    await expect(
      service.save('alice', input, controller.signal),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    const retry = await service.save(
      'alice',
      input,
      new AbortController().signal,
    );
    expect(retry.created).toBe(false);
    expect(db.rows.size).toBe(3);
  });
  it.each([
    {
      Items: [],
      LastEvaluatedKey: {
        pk: 'USER#bob',
        sk: 'POSTING#2026-09-21T12:00:00.000Z#00000000-0000-4000-8000-000000000000',
      },
    },
    { Items: [], LastEvaluatedKey: { pk: 'USER#alice', sk: 'URL#abc' } },
    {},
  ])('rejects invalid database pages', async (response) => {
    const store = createDynamoPostingStore(
      'test-postings',
      async () => response,
    );
    await expect(
      store.list('alice', { limit: 20 }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_STORED_POSTING' });
  });
  it('validates table configuration without revealing its value', () => {
    expect(jobPostingsTable({})).toBeUndefined();
    expect(jobPostingsTable({ JOB_POSTINGS_TABLE: '' })).toBeUndefined();
    expect(
      jobPostingsTable({ JOB_POSTINGS_TABLE: 'huntinwabbit-dev-job-postings' }),
    ).toBe('huntinwabbit-dev-job-postings');
    expect(() =>
      jobPostingsTable({ JOB_POSTINGS_TABLE: 'private invalid value' }),
    ).toThrow('JOB_POSTINGS_TABLE must be a valid DynamoDB table name.');
  });
});
