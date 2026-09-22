import { randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { cleanupDeletedPosting } from './job-postings.cleanup.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from './job-postings.dynamodb.ts';
import { createNoteSchema } from './job-postings.notes.schemas.ts';
import { createRoleNotes } from './job-postings.notes.ts';
import { saveRequestSchema } from './job-postings.schemas.ts';
import { createJobPostings } from './job-postings.service.ts';
import { memoryPostings } from './job-postings.test-support.ts';

async function setup(wrap?: (send: DynamoTransport) => DynamoTransport) {
  const db = memoryPostings();
  const send = wrap ? wrap(db.send) : db.send;
  const postings = createJobPostings(
    createDynamoPostingStore('test', send),
    () => '2026-09-21T00:00:00.000Z',
  );
  const item = (
    await postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://example.com/job' }),
      AbortSignal.timeout(5000),
    )
  ).item;
  let now = Date.parse('2026-09-22T00:00:00.000Z');
  const notes = createRoleNotes('test', send, () => now++);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    jobPostings: postings,
    roleNotes: notes,
  });
  return {
    ...db,
    send,
    postings,
    item,
    notes,
    app,
    input: () => ({
      id: randomUUID(),
      body: '**Fictional** recruiter update\n\n- Prepare questions',
    }),
  };
}
it('persists independent comments, orders pages and isolates owners and role cursors', async () => {
  const s = await setup();
  for (let i = 0; i < 22; i++)
    await s.notes.create('alice', s.item.id, {
      ...s.input(),
      body: `Comment ${i}`,
    });
  const first = await s.notes.list('alice', s.item.id, {});
  expect(first.items).toHaveLength(20);
  expect(first.items[0]?.body).toBe('Comment 21');
  const last = await s.notes.list('alice', s.item.id, {
    cursor: first.nextCursor ?? '',
  });
  expect(last.items.map((note) => note.body)).toEqual([
    'Comment 1',
    'Comment 0',
  ]);
  expect(last.nextCursor).toBeNull();
  await expect(s.notes.list('bob', s.item.id, {})).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    s.notes.create('bob', s.item.id, s.input()),
  ).rejects.toMatchObject({ statusCode: 404 });
  const other = (
    await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://example.com/other' }),
      AbortSignal.timeout(5000),
    )
  ).item;
  await expect(
    s.notes.list('alice', other.id, { cursor: first.nextCursor ?? '' }),
  ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  expect(
    [...s.rows.values()].some((row) => String(row.sk).startsWith('JOB#')),
  ).toBe(false);
});
it('recovers repeated creates and edits, rejects stale revisions, and never resurrects a deleted comment', async () => {
  const s = await setup();
  const input = s.input();
  const note = await s.notes.create('alice', s.item.id, input);
  expect(await s.notes.create('alice', s.item.id, input)).toEqual(note);
  await expect(
    s.notes.create('alice', s.item.id, { ...input, body: 'Different' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  const edit = { body: 'Revised', expectedRevision: 1 };
  expect(await s.notes.edit('alice', s.item.id, input.id, edit)).toMatchObject({
    body: 'Revised',
    revision: 2,
  });
  expect(await s.notes.edit('alice', s.item.id, input.id, edit)).toMatchObject({
    revision: 2,
  });
  await expect(
    s.notes.edit('alice', s.item.id, input.id, { ...edit, body: 'Stale' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    s.notes.delete('alice', s.item.id, input.id, { expectedRevision: 1 }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await s.notes.delete('alice', s.item.id, input.id, { expectedRevision: 2 });
  await s.notes.delete('alice', s.item.id, input.id, { expectedRevision: 2 });
  await expect(s.notes.create('alice', s.item.id, input)).rejects.toMatchObject(
    { statusCode: 409 },
  );
  expect((await s.notes.list('alice', s.item.id, {})).items).toEqual([]);
  expect(JSON.stringify([...s.rows.values()])).not.toContain('Revised');
});
it('recovers lost write acknowledgements without duplicating comments', async () => {
  let armed = false;
  const s = await setup((send) => async (command, signal) => {
    const result = await send(command, signal);
    if (armed && command instanceof TransactWriteCommand) {
      armed = false;
      throw new Error('Lost reply');
    }
    return result;
  });
  armed = true;
  const input = s.input();
  await s.notes.create('alice', s.item.id, input);
  armed = true;
  await s.notes.edit('alice', s.item.id, input.id, {
    body: 'Edited',
    expectedRevision: 1,
  });
  expect((await s.notes.list('alice', s.item.id, {})).items).toHaveLength(1);
  armed = true;
  await s.notes.delete('alice', s.item.id, input.id, { expectedRevision: 2 });
  expect((await s.notes.list('alice', s.item.id, {})).items).toEqual([]);
});
it('rebases concurrent appends and makes stale role deletion conflict', async () => {
  const s = await setup();
  await Promise.all([
    s.notes.create('alice', s.item.id, s.input()),
    s.notes.create('alice', s.item.id, s.input()),
  ]);
  expect((await s.notes.list('alice', s.item.id, {})).items).toHaveLength(2);
  await expect(
    s.postings.delete('alice', s.item.id, 0, AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ statusCode: 409 });
});
it('cleans paginated note rows and tombstones after role deletion, preserving a replacement role', async () => {
  const s = await setup();
  for (let i = 0; i < 28; i++)
    await s.notes.create('alice', s.item.id, s.input());
  const current = await s.postings.get(
    'alice',
    s.item.id,
    AbortSignal.timeout(5000),
  );
  await s.postings.delete(
    'alice',
    s.item.id,
    current.applicationVersion,
    AbortSignal.timeout(5000),
  );
  await expect(s.notes.list('alice', s.item.id, {})).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    s.notes.create('alice', s.item.id, s.input()),
  ).rejects.toMatchObject({ statusCode: 404 });
  const replacement = (
    await s.postings.save(
      'alice',
      saveRequestSchema.parse({ url: s.item.sourceUrl }),
      AbortSignal.timeout(5000),
    )
  ).item;
  await s.notes.create('alice', replacement.id, s.input());
  const key = `DELETE#${s.item.id}`;
  await cleanupDeletedPosting('test', s.send, 'USER#alice', key, Date.now());
  expect(s.rows.has(`USER#alice|${key}`)).toBe(true);
  await cleanupDeletedPosting(
    'test',
    s.send,
    'USER#alice',
    key,
    Date.now() + 120000,
  );
  await cleanupDeletedPosting(
    'test',
    s.send,
    'USER#alice',
    key,
    Date.now() + 240000,
  );
  expect(
    [...s.rows.values()].some((row) => String(row.sk).includes(s.item.id)),
  ).toBe(false);
  expect((await s.notes.list('alice', replacement.id, {})).items).toHaveLength(
    1,
  );
});
it('validates HTTP contracts, authentication, ownership and stored corruption', async () => {
  const s = await setup();
  const path = `/job-postings/${s.item.id}/notes`;
  const input = s.input();
  expect((await request(s.app).get(path)).status).toBe(401);
  expect(
    (
      await request(s.app)
        .post(path)
        .auth('alice', { type: 'bearer' })
        .send({ ...input, body: '  ' })
    ).status,
  ).toBe(400);
  expect(
    createNoteSchema.safeParse({ ...input, body: 'x'.repeat(20001) }).success,
  ).toBe(false);
  expect(
    (
      await request(s.app)
        .post(path)
        .auth('bob', { type: 'bearer' })
        .send(input)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(s.app)
        .post(path)
        .auth('alice', { type: 'bearer' })
        .send(input)
    ).status,
  ).toBe(201);
  expect(
    (await request(s.app).get(path).auth('alice', { type: 'bearer' })).body
      .items,
  ).toHaveLength(1);
  expect(
    (
      await request(s.app)
        .patch(`${path}/${input.id}`)
        .auth('alice', { type: 'bearer' })
        .send({ body: 'Updated', expectedRevision: 1 })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(s.app)
        .delete(`${path}/${input.id}`)
        .auth('alice', { type: 'bearer' })
        .send({ expectedRevision: 2 })
    ).status,
  ).toBe(204);
  await s.notes.create('alice', s.item.id, s.input());
  const row = [...s.rows.values()].find((row) =>
    String(row.sk).includes('#ENTRY#'),
  );
  if (!row) throw new Error('Missing test row');
  row.data = '{}';
  await expect(s.notes.list('alice', s.item.id, {})).rejects.toMatchObject({
    code: 'INVALID_STORED_POSTING',
  });
});

it('does not resurrect notes when role deletion wins the append transaction', async () => {
  let beforeWrite: (() => Promise<void>) | undefined;
  const s = await setup((send) => async (command, signal) => {
    if (
      command instanceof TransactWriteCommand &&
      command.input.TransactItems?.some((entry) =>
        String(entry.Put?.Item?.sk).includes('#ENTRY#'),
      )
    ) {
      const run = beforeWrite;
      beforeWrite = undefined;
      await run?.();
    }
    return send(command, signal);
  });
  beforeWrite = () =>
    s.postings.delete('alice', s.item.id, 0, AbortSignal.timeout(5000));
  await expect(
    s.notes.create('alice', s.item.id, s.input()),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(
    [...s.rows.values()].some((row) => String(row.sk).startsWith('NOTE#')),
  ).toBe(false);
});
