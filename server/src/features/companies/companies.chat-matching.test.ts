import { randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { expect, it, vi } from 'vitest';
import { createPostingCompanies } from '../job-postings/job-postings.companies.ts';
import { createDynamoPostingStore } from '../job-postings/job-postings.dynamodb.ts';
import { saveRequestSchema } from '../job-postings/job-postings.schemas.ts';
import { createJobPostings } from '../job-postings/job-postings.service.ts';
import { memoryPostings } from '../job-postings/job-postings.test-support.ts';
import { effectiveFields } from '../job-postings/job-postings.updates.logic.ts';
import { createRoleUpdateParser } from '../job-postings/job-postings.updates.redpill.ts';
import type { ParseUpdates } from '../job-postings/job-postings.updates.schemas.ts';
import { createRoleUpdates } from '../job-postings/job-postings.updates.ts';
import { createCompanyStore } from './companies.store.ts';

const signal = () => AbortSignal.timeout(5000);

it.each([
  ['Lumen with Example', 'Lumen'],
  ['Lumen', 'Lumen with Example'],
])(
  'groups chat employer %s with %s using posting context',
  async (existing, name) => {
    const db = memoryPostings();
    const companies = createCompanyStore('test', db.send);
    const company = await companies.resolve(
      'USER#alice',
      existing,
      null,
      signal(),
    );
    const foreign = await companies.resolve(
      'USER#bob',
      existing,
      null,
      signal(),
    );
    const postings = createJobPostings(
      createDynamoPostingStore('test', db.send, companies),
    );
    const { item } = await postings.save(
      'alice',
      saveRequestSchema.parse({ url: 'https://jobs.example.test/context' }),
      signal(),
    );
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      const request = JSON.parse(String(options?.body));
      const input = JSON.parse(request.messages[1].content);
      expect(input.companyCandidates).toHaveLength(1);
      expect(input.companyCandidates[0].name).toBe(existing);
      expect(JSON.stringify(input)).not.toContain(company?.id);
      expect(JSON.stringify(input)).not.toContain(foreign?.id);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                changes: [{ field: 'companyName', value: name }],
                skipped: [],
                companyMatch: input.companyCandidates[0].reference,
              }),
            },
          },
        ],
      });
    });
    const updates = createRoleUpdates(
      'test',
      db.send,
      true,
      createRoleUpdateParser('test-key', { fetch: fetcher }),
      Date.now,
      companies,
    );
    const operationId = randomUUID();
    await updates.submit('alice', item.id, {
      operationId,
      text: 'About Lumen with Example. Lumen is the employer. Set the company from this posting.',
      timezone: 'UTC',
    });
    const pending = (await postings.get('alice', item.id, signal())).edits
      ?.pending;
    if (!pending) throw new Error('Missing pending update');
    await updates.run('USER#alice', pending);
    const changed = await postings.get('alice', item.id, signal());
    expect(changed.companyAssociation?.company?.id).toBe(company?.id);
    expect(changed.edits?.overrides.companyName).toBe(name);
    expect(changed.extraction).toEqual(item.extraction);
    expect(await companies.all('USER#alice', signal())).toHaveLength(1);
    expect(
      (
        await companies.roles(
          'USER#alice',
          company?.id as string,
          { limit: 50 },
          signal(),
        )
      ).items.map((x) => x.roleId),
    ).toEqual([item.id]);
    await updates.run('USER#alice', pending);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await updates.undo('alice', item.id, operationId);
    expect(
      (await postings.get('alice', item.id, signal())).companyAssociation
        ?.company,
    ).toBeNull();
  },
);

async function contextSetup() {
  const db = memoryPostings();
  const companies = createCompanyStore('test', db.send);
  const company = await companies.resolve(
    'USER#alice',
    'Lumen with Example',
    'https://lumen.example.test',
    signal(),
  );
  if (!company) throw new Error('Missing company');
  const postings = createJobPostings(
    createDynamoPostingStore('test', db.send, companies),
  );
  const { item } = await postings.save(
    'alice',
    saveRequestSchema.parse({ url: 'https://jobs.example.test/another' }),
    signal(),
  );
  const association = createPostingCompanies('test', db.send, companies);
  async function run(parse: ParseUpdates) {
    const updates = createRoleUpdates(
      'test',
      db.send,
      true,
      parse,
      Date.now,
      companies,
    );
    const operationId = randomUUID();
    await updates.submit('alice', item.id, {
      operationId,
      text: 'About Lumen with Example. Lumen is the employer.',
      timezone: 'UTC',
    });
    const pending = (await postings.get('alice', item.id, signal())).edits
      ?.pending;
    if (!pending) throw new Error('Missing pending update');
    await updates.run('USER#alice', pending);
    return {
      updates,
      operationId,
      item: await postings.get('alice', item.id, signal()),
    };
  }
  return { ...db, companies, company, postings, association, item, run };
}

it.each([
  null,
  'unknown-reference',
  { reference: 'candidate-1' },
  1,
  ['candidate-1'],
])('keeps valid edits when matching metadata is %j', async (companyMatch) => {
  const s = await contextSetup();
  const parser = createRoleUpdateParser('test-key', {
    fetch: async () =>
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                changes: [
                  { field: 'companyName', value: 'Lumen Labs' },
                  { field: 'priority', value: 'high' },
                ],
                skipped: [],
                companyMatch,
              }),
            },
          },
        ],
      }),
  });
  const result = await s.run(parser);
  expect(result.item.application.priority).toBe('high');
  expect(result.item.companyAssociation?.company?.name).toBe('Lumen Labs');
  expect(result.item.companyAssociation?.company?.id).not.toBe(s.company.id);
});

it('rejects a selected candidate when the resulting employer domain conflicts', async () => {
  const s = await contextSetup();
  const result = await s.run(async (_input, _signal, context) => {
    context?.matched(s.company.id);
    return {
      changes: [
        { field: 'companyName', value: 'Lumen' },
        { field: 'companyWebsite', value: 'https://unrelated.example.test' },
      ],
      skipped: [],
    };
  });
  expect(result.item.companyAssociation?.company?.id).not.toBe(s.company.id);
});

it('does not select a company outside the owner shortlist', async () => {
  const s = await contextSetup();
  const foreign = await s.companies.resolve(
    'USER#bob',
    'Lumen',
    null,
    signal(),
  );
  const result = await s.run(async (_input, _signal, context) => {
    context?.matched(foreign?.id as string);
    return { changes: [{ field: 'companyName', value: 'Lumen' }], skipped: [] };
  });
  expect(result.item.companyAssociation?.company?.id).not.toBe(foreign?.id);
  expect(result.item.companyAssociation?.company?.name).toBe('Lumen');
});

it('keeps a newer manual correction and applies unrelated edits', async () => {
  const s = await contextSetup();
  const result = await s.run(async (_input, _signal, context) => {
    const current = await s.postings.get('alice', s.item.id, signal());
    await s.association.select(
      'alice',
      s.item.id,
      {
        expectedRecordVersion: current.recordVersion,
        selection: { create: { name: 'Manual Employer', website: null } },
      },
      signal(),
    );
    context?.matched(s.company.id);
    return {
      changes: [
        { field: 'companyName', value: 'Lumen' },
        { field: 'priority', value: 'high' },
      ],
      skipped: [],
    };
  });
  expect(result.item.companyAssociation?.company?.name).toBe('Manual Employer');
  expect(result.item.application.priority).toBe('high');
});

it('ignores a suggestion on unrelated edits and protects Undo after a manual correction', async () => {
  const s = await contextSetup();
  const unrelated = await s.run(async (_input, _signal, context) => {
    context?.matched(s.company.id);
    return { changes: [{ field: 'priority', value: 'high' }], skipped: [] };
  });
  expect(unrelated.item.companyAssociation).toBeUndefined();
  const matched = await s.run(async (_input, _signal, context) => {
    context?.matched(s.company.id);
    return { changes: [{ field: 'companyName', value: 'Lumen' }], skipped: [] };
  });
  await s.association.select(
    'alice',
    s.item.id,
    { expectedRecordVersion: matched.item.recordVersion, selection: null },
    signal(),
  );
  await expect(
    matched.updates.undo('alice', s.item.id, matched.operationId),
  ).rejects.toMatchObject({ statusCode: 409 });
});

it('bounds provider candidates and exposes only temporary references and employer hostnames', async () => {
  const s = await contextSetup();
  const candidates = Array.from({ length: 25 }, (_, index) => ({
    ...s.company,
    id: `private-id-${index}`,
    name: 'Lumen'.repeat(200),
    website: 'https://lumen.example.test/private?hidden=value',
  }));
  let sent: Record<string, unknown> = {};
  const matched = vi.fn();
  const parser = createRoleUpdateParser('test-key', {
    fetch: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      sent = JSON.parse(body.messages[1].content);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                changes: [],
                skipped: [],
                companyMatch: 'candidate-20',
              }),
            },
          },
        ],
      });
    },
  });
  const { notes: _notes, ...current } = effectiveFields(s.item);
  await parser(
    { text: 'Update employer', current, history: [], today: '2026-09-22' },
    signal(),
    { candidates, matched },
  );
  expect(sent.companyCandidates).toHaveLength(20);
  expect(JSON.stringify(sent)).not.toContain('private-id');
  expect(JSON.stringify(sent)).not.toContain('/private');
  expect(JSON.stringify(sent)).not.toContain('hidden=value');
  expect(JSON.stringify(sent)).not.toContain('Lumen'.repeat(101));
  expect(matched).toHaveBeenCalledWith('private-id-19');
});

it('recovers a lost contextual completion acknowledgement without another model call', async () => {
  const s = await contextSetup();
  let lose = true;
  const parse = vi.fn<ParseUpdates>(async (_input, _signal, context) => {
    context?.matched(s.company.id);
    return { changes: [{ field: 'companyName', value: 'Lumen' }], skipped: [] };
  });
  const updates = createRoleUpdates(
    'test',
    async (command, abort) => {
      const result = await s.send(command, abort);
      if (
        lose &&
        command instanceof TransactWriteCommand &&
        command.input.TransactItems?.some(
          (write) => write.Put?.Item?.status === 'applied',
        )
      ) {
        lose = false;
        throw new Error('Lost acknowledgement');
      }
      return result;
    },
    true,
    parse,
    Date.now,
    s.companies,
  );
  await updates.submit('alice', s.item.id, {
    operationId: randomUUID(),
    text: 'About Lumen with Example. Set company to Lumen.',
    timezone: 'UTC',
  });
  const pending = (await s.postings.get('alice', s.item.id, signal())).edits
    ?.pending;
  if (!pending) throw new Error('Missing pending update');
  await updates.run('USER#alice', pending);
  await updates.run('USER#alice', pending);
  expect(parse).toHaveBeenCalledTimes(1);
  expect(
    (await s.postings.get('alice', s.item.id, signal())).companyAssociation
      ?.company?.id,
  ).toBe(s.company.id);
  expect((await updates.history('alice', s.item.id, {})).items[0]?.status).toBe(
    'applied',
  );
});
