import { GetCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.ts';
import { guidanceRequestSchema } from './source-guidance.schemas.ts';
import {
  createSourceGuidance,
  type GuidanceTransport,
} from './source-guidance.store.ts';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const order = (time: number) =>
  `${String(time).padStart(13, '0')}#00000000-0000-4000-8000-000000000000`;
function storage() {
  const records = new Map<string, Record<string, unknown>>();
  const send: GuidanceTransport = async (command) => {
    if (command instanceof GetCommand)
      return { Item: records.get(String(command.input.Key?.pk)) };
    const put = command.input.TransactItems?.[0]?.Put;
    if (!put?.Item) throw new Error('Expected write');
    // Model the adapter's conditional-write contract rather than assuming every put is ordered.
    if (
      put.ConditionExpression !==
        'attribute_not_exists(pk) OR #order < :order' ||
      put.ExpressionAttributeNames?.['#order'] !== 'order' ||
      put.ExpressionAttributeValues?.[':order'] !== put.Item.order
    )
      throw new Error('Unsupported guidance condition');
    const old = records.get(String(put.Item.pk));
    if (old && String(old.order) >= String(put.Item.order))
      throw {
        name: 'TransactionCanceledException',
        CancellationReasons: [{ Code: 'ConditionalCheckFailed' }],
      };
    records.set(String(put.Item.pk), put.Item);
    return {};
  };
  return { records, send };
}

it.each([
  ['WWW.Indeed.COM.', 'indeed.com'],
  ['jobs.example.test', 'jobs.example.test'],
  ['www.jobs.example.test', 'jobs.example.test'],
])('normalizes guidance host %s', (hostname, expected) => {
  expect(guidanceRequestSchema.parse({ hostname }).hostname).toBe(expected);
});
it.each([
  'https://indeed.com',
  'indeed.com/path',
  'indeed.com?private=yes',
  'user@indeed.com',
  'indeed.com:443',
  '.com',
  'localhost',
  'a..test',
  '127.0.0.1',
  '-bad.test',
  `${'a'.repeat(64)}.test`,
])('rejects non-host input %s', (hostname) => {
  expect(guidanceRequestSchema.safeParse({ hostname }).success).toBe(false);
});
it('seeds Indeed without storage and never expands to other subdomains or lookalikes', async () => {
  const db = storage();
  const registry = createSourceGuidance('test-table', db.send);
  expect(await createSourceGuidance().lookup('www.indeed.com')).toEqual({
    hostname: 'indeed.com',
    recommendSourceText: true,
  });
  for (const hostname of [
    'indeed.com.evil.test',
    'notindeed.com',
    'uk.indeed.com',
  ]) {
    expect((await registry.lookup(hostname)).recommendSourceText).toBe(false);
  }
  await registry.observe({
    hostname: 'indeed.com',
    outcome: 'usable',
    order: order(10),
  });
  expect((await registry.lookup('indeed.com')).recommendSourceText).toBe(true);
  expect(db.records.size).toBe(0);
});
it('shares learning across fresh instances, clears on success, and fences older/replayed observations', async () => {
  const db = storage();
  const first = createSourceGuidance('test-table', db.send);
  const second = createSourceGuidance('test-table', db.send);
  const blocked = {
    hostname: 'jobs.example.test',
    outcome: 'blocked' as const,
    order: order(10),
  };
  await first.observe(blocked);
  expect(
    (await second.lookup('www.jobs.example.test')).recommendSourceText,
  ).toBe(true);
  expect((await second.lookup('other.example.test')).recommendSourceText).toBe(
    false,
  );
  await second.observe({ ...blocked, outcome: 'usable', order: order(20) });
  await first.observe(blocked);
  expect((await first.lookup(blocked.hostname)).recommendSourceText).toBe(
    false,
  );
  await first.observe({ ...blocked, order: order(30) });
  await second.observe({ ...blocked, outcome: 'usable', order: order(20) });
  expect((await second.lookup(blocked.hostname)).recommendSourceText).toBe(
    true,
  );
  expect(console.warn).not.toHaveBeenCalled();
  expect([...db.records.values()][0]).toEqual({
    pk: 'SOURCE-GUIDANCE#jobs.example.test',
    sk: 'GUIDANCE',
    hostname: blocked.hostname,
    blocked: true,
    order: order(30),
  });
});
it('does not let a delayed block beat an earlier-completed newer success', async () => {
  const db = storage();
  const registry = createSourceGuidance('test-table', db.send);
  await registry.observe({
    hostname: 'jobs.example.test',
    outcome: 'usable',
    order: order(20),
  });
  await registry.observe({
    hostname: 'jobs.example.test',
    outcome: 'blocked',
    order: order(10),
  });
  expect((await registry.lookup('jobs.example.test')).recommendSourceText).toBe(
    false,
  );
});
it('fails lookup honestly and keeps observation errors content-free', async () => {
  const registry = createSourceGuidance('test-table', async () => {
    throw new Error('private URL and SDK payload');
  });
  await expect(registry.lookup('jobs.example.test')).rejects.toMatchObject({
    code: 'GUIDANCE_UNAVAILABLE',
  });
  await expect(
    registry.observe({
      hostname: 'jobs.example.test',
      outcome: 'blocked',
      order: order(10),
    }),
  ).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    '{"event":"source_guidance.observation_failed"}',
  );
  await expect(
    createSourceGuidance().lookup('jobs.example.test'),
  ).rejects.toMatchObject({ code: 'GUIDANCE_UNAVAILABLE' });
});
it('bounds a stalled adapter without blocking extraction indefinitely', async () => {
  vi.useFakeTimers();
  const registry = createSourceGuidance(
    'test-table',
    () => new Promise(() => {}),
  );
  const write = registry.observe({
    hostname: 'jobs.example.test',
    outcome: 'blocked',
    order: order(10),
  });
  await vi.advanceTimersByTimeAsync(2_000);
  await expect(write).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledOnce();
});
it('rejects corrupt or mismatched persisted records', async () => {
  const db = storage();
  db.records.set('SOURCE-GUIDANCE#jobs.example.test', {
    pk: 'SOURCE-GUIDANCE#other.test',
    sk: 'GUIDANCE',
    hostname: 'other.test',
    blocked: true,
    order: order(10),
  });
  await expect(
    createSourceGuidance('test-table', db.send).lookup('jobs.example.test'),
  ).rejects.toMatchObject({ code: 'GUIDANCE_UNAVAILABLE' });
});
it('authenticates before reading, serves the same guidance to two users, and rejects writes of classifications', async () => {
  const db = storage();
  const registry = createSourceGuidance('test-table', db.send);
  await registry.observe({
    hostname: 'jobs.example.test',
    outcome: 'blocked',
    order: order(10),
  });
  const lookup = vi.fn(registry.lookup);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    sourceGuidance: { ...registry, lookup },
  });
  await request(app)
    .post('/job-postings/source-guidance')
    .send({ hostname: 'jobs.example.test' })
    .expect(401);
  expect(lookup).not.toHaveBeenCalled();
  for (const user of ['user-one', 'user-two']) {
    const response = await request(app)
      .post('/job-postings/source-guidance')
      .auth(user, { type: 'bearer' })
      .send({ hostname: 'jobs.example.test' })
      .expect(200);
    expect(response.body).toEqual({
      hostname: 'jobs.example.test',
      recommendSourceText: true,
    });
    expect(response.headers['cache-control']).toContain('no-store');
  }
  await request(app)
    .post('/job-postings/source-guidance')
    .auth('user-one', { type: 'bearer' })
    .send({ hostname: 'jobs.example.test', blocked: true })
    .expect(400);
  await request(app)
    .post('/job-postings/source-guidance?hostname=other.test')
    .auth('user-one', { type: 'bearer' })
    .send({ hostname: 'jobs.example.test' })
    .expect(400);
  expect(lookup).toHaveBeenCalledTimes(2);
});
