import { expect, it, vi } from 'vitest';
import { createCompanyStore } from '../src/features/companies/companies.index.ts';
import { createPostingCompanies } from '../src/features/job-postings/job-postings.companies.ts';
import { createDynamoPostingStore } from '../src/features/job-postings/job-postings.dynamodb.ts';
import { saveRequestSchema } from '../src/features/job-postings/job-postings.schemas.ts';
import { createJobPostings } from '../src/features/job-postings/job-postings.service.ts';
import { memoryPostings } from '../src/features/job-postings/job-postings.test-support.ts';
import { reassignCompany } from './reassign-company.ts';

const account = '123456789012';
const signal = () => AbortSignal.timeout(5000);
async function setup() {
  const db = memoryPostings();
  const companies = createCompanyStore('test', db.send);
  const from = await companies.resolve('USER#alice', 'Lumen', null, signal());
  const to = await companies.resolve(
    'USER#alice',
    'Lumen with Example',
    null,
    signal(),
  );
  if (!from || !to) throw new Error('Missing companies');
  const postings = createDynamoPostingStore('test', db.send, companies);
  const service = createJobPostings(postings);
  const saved = await service.save(
    'alice',
    saveRequestSchema.parse({ url: 'https://jobs.example.test/repair' }),
    signal(),
  );
  const associations = createPostingCompanies('test', db.send, companies);
  const item = await associations.select(
    'alice',
    saved.item.id,
    {
      expectedRecordVersion: saved.item.recordVersion,
      selection: { id: from.id },
    },
    signal(),
  );
  const select = vi.spyOn(associations, 'select');
  const input = {
    account,
    role: item.id,
    from: from.id,
    to: to.id,
    version: item.recordVersion,
    apply: false,
  };
  return { ...db, companies, postings, associations, select, item, input };
}

it('previews without writes, reassigns with readback and repeats without another write', async () => {
  const s = await setup();
  const before = structuredClone([...s.rows.entries()]);
  expect(await reassignCompany(s.input, account, 'alice', s, signal())).toBe(
    'eligible',
  );
  expect([...s.rows.entries()]).toEqual(before);
  const input = { ...s.input, apply: true };
  expect(await reassignCompany(input, account, 'alice', s, signal())).toBe(
    'reassigned',
  );
  expect(await reassignCompany(input, account, 'alice', s, signal())).toBe(
    'already-assigned',
  );
  expect(s.select).toHaveBeenCalledTimes(1);
  const current = await s.postings.get('alice', s.item.id, signal());
  expect(current.extraction).toEqual(s.item.extraction);
  expect(current.parsedPosting).toEqual(s.item.parsedPosting);
  expect(current.application).toEqual(s.item.application);
  expect(
    await s.companies.get('USER#alice', input.from, signal()),
  ).toBeDefined();
});

it('rejects account, owner, source and version mismatches without selecting', async () => {
  const s = await setup();
  await expect(
    reassignCompany(s.input, '999999999999', 'alice', s, signal()),
  ).rejects.toThrow('AWS account mismatch');
  await expect(
    reassignCompany(s.input, account, 'bob', s, signal()),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    reassignCompany(
      { ...s.input, version: 999, apply: true },
      account,
      'alice',
      s,
      signal(),
    ),
  ).rejects.toThrow('version changed');
  await s.associations.select(
    'alice',
    s.item.id,
    { expectedRecordVersion: s.item.recordVersion, selection: null },
    signal(),
  );
  s.select.mockClear();
  await expect(
    reassignCompany({ ...s.input, apply: true }, account, 'alice', s, signal()),
  ).rejects.toThrow('association or version changed');
  expect(s.select).not.toHaveBeenCalled();
});

it('refuses a concurrent edit between review and the conditional write', async () => {
  const s = await setup();
  const original = s.associations.select.bind(s.associations);
  s.select.mockImplementationOnce(async (...args) => {
    await original(
      'alice',
      s.item.id,
      { expectedRecordVersion: s.item.recordVersion, selection: null },
      signal(),
    );
    return original(...args);
  });
  await expect(
    reassignCompany({ ...s.input, apply: true }, account, 'alice', s, signal()),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(
    (await s.postings.get('alice', s.item.id, signal())).companyAssociation
      ?.company,
  ).toBeNull();
});
