import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.ts';
import { createPostingCompanies } from '../job-postings/job-postings.companies.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from '../job-postings/job-postings.dynamodb.ts';
import { parsedPostingFixture } from '../job-postings/job-postings.fixtures.ts';
import { saveRequestSchema } from '../job-postings/job-postings.schemas.ts';
import { createJobPostings } from '../job-postings/job-postings.service.ts';
import { memoryPostings } from '../job-postings/job-postings.test-support.ts';
import { createRoleUpdates } from '../job-postings/job-postings.updates.ts';
import { createExtractionWorker } from '../job-postings/job-postings.worker.ts';
import {
  companyDomain,
  companyNameKey,
  matchCompany,
  shortlistCompanies,
} from './companies.matching.ts';
import type { Company } from './companies.schemas.ts';
import { createCompanyStore } from './companies.store.ts';

const signal = () => AbortSignal.timeout(5000);
const now = '2026-09-22T12:00:00.000Z';
const a: Company = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Example Company',
  website: 'https://www.example.test',
  createdAt: now,
  updatedAt: now,
};
function setup(wrap?: (send: DynamoTransport) => DynamoTransport) {
  const db = memoryPostings();
  const send = wrap ? wrap(db.send) : db.send;
  const companies = createCompanyStore('test', send);
  const postings = createJobPostings(
    createDynamoPostingStore('test', send, companies),
    undefined,
    undefined,
    true,
  );
  const association = createPostingCompanies('test', send, companies);
  const app = buildApp({
    verifyAccessToken: async (token) => ({ userId: token }),
    jobPostings: postings,
    companies,
    postingCompanies: association,
  });
  async function save(
    name = 'Example Company',
    url = 'https://jobs.example.test/one',
  ) {
    const facts = parsedPostingFixture();
    facts.source.normalizedUrl = url;
    facts.job.company = { name, website: 'https://example.test' };
    return (
      await postings.save(
        'alice',
        saveRequestSchema.parse({ url, parsedPosting: facts }),
        signal(),
      )
    ).item;
  }
  return { ...db, send, companies, postings, association, app, save };
}
describe('company identity', () => {
  it('matches conservative evidence and ranks bounded candidates without grouping subsidiaries', () => {
    expect(companyNameKey('  EXAMPLE   Company ')).toBe('example company');
    expect(companyDomain('https://www.example.test/jobs')).toBe('example.test');
    expect(companyDomain('invalid')).toBeNull();
    expect(companyDomain('ftp://example.test')).toBeNull();
    expect(companyDomain(null)).toBeNull();
    expect(matchCompany([a], 'EXAMPLE Company', null)).toEqual(a);
    expect(
      matchCompany([a], 'Example Company', 'https://unrelated.test'),
    ).toBeUndefined();
    expect(
      matchCompany([a], 'Example Company Inc.', 'https://example.test'),
    ).toEqual(a);
    expect(
      matchCompany([a], 'Example Subsidiary', 'https://example.test'),
    ).toBeUndefined();
    expect(
      matchCompany([a, { ...a, id: 'other' }], 'Example Company', null),
    ).toBeUndefined();
    expect(
      shortlistCompanies(
        [
          a,
          {
            ...a,
            id: 'other',
            name: 'Unrelated',
            website: 'https://unrelated.test',
          },
        ],
        'Work at Example Company: https://example.test',
      ),
    ).toEqual([a]);
    expect(
      shortlistCompanies(
        Array.from({ length: 25 }, (_, i) => ({ ...a, id: String(i) })),
        'Example Company',
      ),
    ).toHaveLength(20);
  });
  it('creates one company under racing identical saves and recovers lost acknowledgements', async () => {
    let lose = true;
    const s = setup((send) => async (command, abort) => {
      const result = await send(command, abort);
      if (lose && command instanceof TransactWriteCommand) {
        lose = false;
        throw new Error('lost');
      }
      return result;
    });
    const [first, second] = await Promise.all([
      s.companies.resolve('USER#alice', 'Example', null, signal()),
      s.companies.resolve('USER#alice', 'example', null, signal()),
    ]);
    expect(first?.id).toBe(second?.id);
    expect(await s.companies.all('USER#alice', signal())).toHaveLength(1);
    expect(
      await s.companies.resolve('USER#alice', null, null, signal()),
    ).toBeNull();
  });
});
describe('company roles', () => {
  it('links saves, separates users, paginates with company-bound cursors and retains empty companies', async () => {
    const s = setup();
    const first = await s.save();
    const second = await s.save(
      'EXAMPLE Company',
      'https://jobs.example.test/two',
    );
    const id = first.companyAssociation?.company?.id as string;
    expect(second.companyAssociation?.company?.id).toBe(id);
    const page = await s.association.roles('alice', id, { limit: 1 }, signal());
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    const next = await s.association.roles(
      'alice',
      id,
      { limit: 1, cursor: page.nextCursor ?? undefined },
      signal(),
    );
    expect(next.items).toHaveLength(1);
    expect(new Set([...page.items, ...next.items].map((x) => x.id)).size).toBe(
      2,
    );
    await expect(
      s.companies.get('USER#bob', id, signal()),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      s.companies.roles(
        'USER#alice',
        id,
        { limit: 1, cursor: 'garbage' },
        signal(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    const other = await s.companies.resolve(
      'USER#alice',
      'Other',
      null,
      signal(),
    );
    await expect(
      s.companies.roles(
        'USER#alice',
        other?.id as string,
        { limit: 1, cursor: page.nextCursor ?? undefined },
        signal(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    for (const item of [first, second])
      await s.postings.delete(
        'alice',
        item.id,
        item.applicationVersion,
        signal(),
      );
    expect(
      (await s.association.roles('alice', id, { limit: 50 }, signal())).items,
    ).toEqual([]);
    expect((await s.companies.get('USER#alice', id, signal())).name).toBe(
      'Example Company',
    );
  });
  it('moves only the selected role, handles conflicts and preserves manual choices on refresh', async () => {
    const s = setup();
    const first = await s.save();
    const second = await s.save(
      'Example Company',
      'https://jobs.example.test/two',
    );
    const changed = await s.association.select(
      'alice',
      first.id,
      {
        expectedRecordVersion: first.recordVersion,
        selection: { create: { name: 'Different', website: null } },
      },
      signal(),
    );
    expect(
      (
        await s.association.roles(
          'alice',
          second.companyAssociation?.company?.id as string,
          { limit: 50 },
          signal(),
        )
      ).items.map((x) => x.id),
    ).toEqual([second.id]);
    await expect(
      s.association.select(
        'alice',
        first.id,
        { expectedRecordVersion: 0, selection: null },
        signal(),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const queued = await s.postings.extract('alice', first.id, null, signal());
    const parse = vi.fn(async () => {
      const result = parsedPostingFixture();
      result.source.normalizedUrl = first.sourceUrl;
      return result;
    });
    const worker = createExtractionWorker(
      'test',
      s.send,
      parse,
      Date.now,
      undefined,
      s.companies,
    );
    await worker.run('USER#alice', `JOB#${queued.extraction.generation}`);
    const refreshed = await s.postings.get('alice', first.id, signal());
    expect(refreshed.companyAssociation).toEqual(changed.companyAssociation);
    expect(parse).toHaveBeenCalledTimes(1);
    const cleared = await s.association.select(
      'alice',
      first.id,
      { expectedRecordVersion: refreshed.recordVersion, selection: null },
      signal(),
    );
    expect(cleared.companyAssociation?.company).toBeNull();
    expect(cleared.companyAssociation?.mode).toBe('manual');
  });
  it('rejects selecting another owner’s company and recovers a lost selection acknowledgement', async () => {
    let lose = false;
    const s = setup((send) => async (command, abort) => {
      const result = await send(command, abort);
      if (lose && command instanceof TransactWriteCommand) {
        lose = false;
        throw new Error('lost');
      }
      return result;
    });
    const role = await s.save();
    const other = await s.companies.resolve(
      'USER#bob',
      'Foreign',
      null,
      signal(),
    );
    await expect(
      s.association.select(
        'alice',
        role.id,
        {
          expectedRecordVersion: role.recordVersion,
          selection: { id: other?.id as string },
        },
        signal(),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    lose = true;
    expect(
      (
        await s.association.select(
          'alice',
          role.id,
          { expectedRecordVersion: role.recordVersion, selection: null },
          signal(),
        )
      ).companyAssociation?.company,
    ).toBeNull();
  });
  it('uses a validated extraction suggestion', async () => {
    const s = setup();
    const company = await s.companies.resolve(
      'USER#alice',
      'Example Company',
      null,
      signal(),
    );
    const queued = await s.postings.save(
      'alice',
      saveRequestSchema.parse({
        url: 'https://jobs.example.test/new',
        extract: true,
      }),
      signal(),
    );
    const worker = createExtractionWorker(
      'test',
      s.send,
      async (_url, abort, context) => {
        expect(
          await context?.candidates('Example Company', abort),
        ).toHaveLength(1);
        context?.matched(company?.id as string);
        const result = parsedPostingFixture();
        result.source.normalizedUrl = queued.item.sourceUrl;
        result.job.company.name = 'Example International';
        return result;
      },
      Date.now,
      undefined,
      s.companies,
    );
    await worker.run('USER#alice', `JOB#${queued.item.extraction.generation}`);
    expect(
      (await s.postings.get('alice', queued.item.id, signal()))
        .companyAssociation?.company?.id,
    ).toBe(company?.id);
  });
  it('backfills without inference, preserves history and is safe to repeat', async () => {
    const s = setup();
    const legacy = createJobPostings(createDynamoPostingStore('test', s.send));
    const facts = parsedPostingFixture();
    const { item } = await legacy.save(
      'alice',
      saveRequestSchema.parse({
        url: facts.source.normalizedUrl,
        parsedPosting: facts,
        application: { notes: 'Fictional note' },
      }),
      signal(),
    );
    expect(await s.association.backfill('alice', item.id, signal(), true)).toBe(
      true,
    );
    expect(await s.companies.all('USER#alice', signal())).toEqual([]);
    expect(await s.association.backfill('alice', item.id, signal())).toBe(true);
    expect(await s.association.backfill('alice', item.id, signal())).toBe(
      false,
    );
    const saved = await s.postings.get('alice', item.id, signal());
    expect(saved.application).toEqual(item.application);
    expect(saved.parsedPosting).toEqual(item.parsedPosting);
    expect(saved.extraction).toEqual(item.extraction);
  });
  it('protects HTTP routes and validates selection', async () => {
    const s = setup();
    const role = await s.save();
    const id = role.companyAssociation?.company?.id;
    expect((await request(s.app).get(`/companies/${id}`)).status).toBe(401);
    expect(
      (
        await request(s.app)
          .get(`/companies/${id}`)
          .auth('bob', { type: 'bearer' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(s.app)
          .get(`/companies/${id}`)
          .auth('alice', { type: 'bearer' })
      ).body.item.id,
    ).toBe(id);
    expect(
      (
        await request(s.app)
          .get('/companies?q=missing')
          .auth('alice', { type: 'bearer' })
      ).body.items,
    ).toEqual([]);
    expect(
      (
        await request(s.app)
          .get(`/companies/${id}/roles`)
          .auth('alice', { type: 'bearer' })
      ).body.items[0].id,
    ).toBe(role.id);
    expect(
      (
        await request(s.app)
          .patch(`/job-postings/${role.id}/company`)
          .auth('alice', { type: 'bearer' })
          .send({ expectedRecordVersion: role.recordVersion, selection: null })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(s.app)
          .patch(`/job-postings/${role.id}/company`)
          .auth('alice', { type: 'bearer' })
          .send({ selection: null })
      ).status,
    ).toBe(400);
  });
  it('chat moves roles, Undo restores associations, and manual edits fence stale chat', async () => {
    const s = setup();
    const role = await s.save();
    const updates = createRoleUpdates(
      'test',
      s.send,
      true,
      async () => ({
        changes: [{ field: 'companyName', value: 'Different Company' }],
        skipped: [],
      }),
      Date.now,
      s.companies,
    );
    const op = '00000000-0000-4000-8000-000000000088';
    await updates.submit('alice', role.id, {
      operationId: op,
      text: 'Change company',
      timezone: 'UTC',
    });
    const pending = await s.postings.get('alice', role.id, signal());
    await updates.run('USER#alice', pending.edits?.pending as string);
    const changed = await s.postings.get('alice', role.id, signal());
    expect(changed.companyAssociation?.company?.name).toBe('Different Company');
    await updates.undo('alice', role.id, op);
    const restored = await s.postings.get('alice', role.id, signal());
    expect(restored.companyAssociation?.company?.id).toBe(
      role.companyAssociation?.company?.id,
    );
    const op2 = '00000000-0000-4000-8000-000000000089';
    await updates.submit('alice', role.id, {
      operationId: op2,
      text: 'Change again',
      timezone: 'UTC',
    });
    const pending2 = await s.postings.get('alice', role.id, signal());
    await s.association.select(
      'alice',
      role.id,
      { expectedRecordVersion: pending2.recordVersion, selection: null },
      signal(),
    );
    await updates.run('USER#alice', pending2.edits?.pending as string);
    expect(
      (await s.postings.get('alice', role.id, signal())).companyAssociation
        ?.company,
    ).toBeNull();
    expect(
      (await updates.history('alice', role.id, {})).items[0]?.skipped.join(' '),
    ).toContain('company selection changed');
  });
});

it('automatic refresh moves membership and a manual correction during inference wins', async () => {
  const s = setup();
  let item = await s.save();
  const oldId = item.companyAssociation?.company?.id as string;
  let queued = await s.postings.extract('alice', item.id, null, signal());
  const worker = createExtractionWorker(
    'test',
    s.send,
    async () => {
      const result = parsedPostingFixture();
      result.source.normalizedUrl = item.sourceUrl;
      result.job.company = { name: 'Different Employer', website: null };
      return result;
    },
    Date.now,
    undefined,
    s.companies,
  );
  await worker.run('USER#alice', `JOB#${queued.extraction.generation}`);
  item = await s.postings.get('alice', item.id, signal());
  expect(item.companyAssociation?.company?.name).toBe('Different Employer');
  expect(
    (await s.association.roles('alice', oldId, { limit: 50 }, signal())).items,
  ).toHaveLength(0);
  queued = await s.postings.extract(
    'alice',
    item.id,
    item.extraction.generation,
    signal(),
  );
  const racing = createExtractionWorker(
    'test',
    s.send,
    async () => {
      const current = await s.postings.get('alice', item.id, signal());
      await s.association.select(
        'alice',
        item.id,
        { expectedRecordVersion: current.recordVersion, selection: null },
        signal(),
      );
      const result = parsedPostingFixture();
      result.source.normalizedUrl = item.sourceUrl;
      return result;
    },
    Date.now,
    undefined,
    s.companies,
  );
  await racing.run('USER#alice', `JOB#${queued.extraction.generation}`);
  expect(
    (await s.postings.get('alice', item.id, signal())).companyAssociation
      ?.company,
  ).toBeNull();
});
it('Undo refuses to overwrite a subsequent manual company choice', async () => {
  const s = setup();
  const item = await s.save();
  const updates = createRoleUpdates(
    'test',
    s.send,
    true,
    async () => ({
      changes: [{ field: 'companyName', value: 'New Employer' }],
      skipped: [],
    }),
    Date.now,
    s.companies,
  );
  const operationId = '00000000-0000-4000-8000-000000000090';
  await updates.submit('alice', item.id, {
    operationId,
    text: 'Change employer',
    timezone: 'UTC',
  });
  const pending = await s.postings.get('alice', item.id, signal());
  await updates.run('USER#alice', pending.edits?.pending as string);
  const changed = await s.postings.get('alice', item.id, signal());
  await s.association.select(
    'alice',
    item.id,
    { expectedRecordVersion: changed.recordVersion, selection: null },
    signal(),
  );
  await expect(
    updates.undo('alice', item.id, operationId),
  ).rejects.toMatchObject({ statusCode: 409 });
});

it('chat can return a manually assigned role to its original extracted employer', async () => {
  const s = setup();
  const item = await s.save();
  await s.association.select(
    'alice',
    item.id,
    {
      expectedRecordVersion: item.recordVersion,
      selection: { create: { name: 'Manual Employer', website: null } },
    },
    signal(),
  );
  const updates = createRoleUpdates(
    'test',
    s.send,
    true,
    async (input) => {
      expect(input.current.companyName).toBe('Manual Employer');
      return {
        changes: [{ field: 'companyName', value: 'Example Company' }],
        skipped: [],
      };
    },
    Date.now,
    s.companies,
  );
  await updates.submit('alice', item.id, {
    operationId: '00000000-0000-4000-8000-000000000091',
    text: 'Return to the original employer',
    timezone: 'UTC',
  });
  const pending = await s.postings.get('alice', item.id, signal());
  await updates.run('USER#alice', pending.edits?.pending as string);
  expect(
    (await s.postings.get('alice', item.id, signal())).companyAssociation
      ?.company?.id,
  ).toBe(item.companyAssociation?.company?.id);
});

it('reuses an ambiguous-name profile for repeated identical evidence', async () => {
  const s = setup();
  await s.companies.resolve(
    'USER#alice',
    'Shared Name',
    'https://one.example',
    signal(),
  );
  await s.companies.resolve(
    'USER#alice',
    'Shared Name',
    'https://two.example',
    signal(),
  );
  const unknown = await s.companies.resolve(
    'USER#alice',
    'Shared Name',
    null,
    signal(),
  );
  const again = await s.companies.resolve(
    'USER#alice',
    'shared name',
    null,
    signal(),
  );
  expect(again?.id).toBe(unknown?.id);
  expect(await s.companies.all('USER#alice', signal())).toHaveLength(3);
});
