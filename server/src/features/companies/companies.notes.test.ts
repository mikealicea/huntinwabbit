import { randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { createNoteSchema } from '../../shared/shared.notes.schemas.ts';
import type { NotesTransport } from '../../shared/shared.notes.ts';
import { memoryPostings } from '../job-postings/job-postings.test-support.ts';
import { createCompanyNotes } from './companies.notes.ts';
import { createCompanyStore } from './companies.store.ts';

async function setup(wrap?: (send: NotesTransport) => NotesTransport) {
  const db = memoryPostings(),
    send = wrap ? wrap(db.send) : db.send;
  const companies = createCompanyStore('test', send);
  const item = await companies.resolve(
    'USER#alice',
    'Fictional company',
    null,
    AbortSignal.timeout(5000),
  );
  if (!item) throw new Error();
  let now = Date.parse('2026-09-22T00:00:00.000Z');
  const notes = createCompanyNotes('test', send, () => now++);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    companyNotes: notes,
  });
  return {
    ...db,
    send,
    companies,
    item,
    notes,
    app,
    input: () => ({ id: randomUUID(), body: '**Fictional** recruiter update' }),
  };
}
it('persists independent comments, orders pages and isolates owners and company cursors', async () => {
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
  const other = await s.companies.resolve(
    'USER#alice',
    'Other company',
    null,
    AbortSignal.timeout(5000),
  );
  if (!other) throw new Error();
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
it('validates HTTP contracts, authentication, ownership and stored corruption', async () => {
  const s = await setup();
  const path = `/companies/${s.item.id}/notes`;
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

it('serializes concurrent appends and edits and invalidates analysis exactly once per accepted mutation', async () => {
  const s = await setup();
  const firstInput = s.input();
  const inputs = [firstInput, s.input()];
  await Promise.all(
    inputs.map((input) => s.notes.create('alice', s.item.id, input)),
  );
  expect((await s.notes.list('alice', s.item.id, {})).items).toHaveLength(2);
  const outcomes = await Promise.allSettled(
    ['First edit', 'Second edit'].map((body) =>
      s.notes.edit('alice', s.item.id, firstInput.id, {
        body,
        expectedRevision: 1,
      }),
    ),
  );
  expect(
    outcomes.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  const revision = [...s.rows.values()].find((row) =>
    String(row.sk).startsWith('CA-SOURCE#'),
  );
  expect(revision?.revision).toBe(3);
  await s.notes.delete('alice', s.item.id, firstInput.id, {
    expectedRevision: 2,
  });
  expect(
    [...s.rows.values()].find((row) => String(row.sk).startsWith('CA-SOURCE#'))
      ?.hidden,
  ).toBe(true);
});
