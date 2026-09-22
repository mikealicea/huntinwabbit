import { expect, it } from 'vitest';
import { postingFixtures } from '@/features/job-api/job-api.test-support';
import { mergePostingPages, toOpportunity } from './job-search.mapping';

it('preserves the full API record and independent application data', () => {
  const item = postingFixtures()[0];
  const role = toOpportunity(item);
  expect(role.saved).toBe(item);
  expect(role.companyName).toBe('Northstar');
  expect(role.tasks).toEqual([]);
  expect(role.posting?.salary?.minimum).toBe(170000);
  expect(role.stage).toBe(item.application.stage);
});
it('keeps unknown facts and compensation honest', () => {
  const item = postingFixtures()[0];
  expect(toOpportunity({ ...item, parsedPosting: null })).toMatchObject({
    posting: null,
    companyName: null,
  });
  if (!item.parsedPosting) throw new Error('Fixture needs facts');
  const parsedPosting = {
    ...item.parsedPosting,
    job: {
      ...item.parsedPosting.job,
      company: { name: null, website: null },
      locations: [],
      compensation: [],
    },
  };
  expect(toOpportunity({ ...item, parsedPosting }).posting).toMatchObject({
    location: null,
    salary: null,
  });
  const unknown = {
    ...item.parsedPosting,
    job: {
      ...item.parsedPosting.job,
      compensation: [
        {
          minimum: null,
          maximum: 100,
          currency: null,
          period: null,
          kind: null,
          location: null,
          originalText: 'Up to 100',
        },
      ],
    },
  };
  expect(
    toOpportunity({ ...item, parsedPosting: unknown }).posting?.salary,
  ).toMatchObject({
    currency: 'Currency not listed',
    period: 'period not listed',
  });
});

it('deduplicates pages without allowing older records to overwrite newer ones', () => {
  const [a, b] = postingFixtures();
  const newer = { ...a, recordVersion: 2 };
  expect(mergePostingPages([{ items: [a, b] }, { items: [newer, a] }])).toEqual(
    [newer, b],
  );
  expect(mergePostingPages([])).toEqual([]);
});

it('maps user corrections and explicit clears consistently even without extracted facts', () => {
  const item = postingFixtures()[0];
  const edits = {
    overrides: {
      companyName: 'Corrected company',
      companyWebsite: 'https://example.test/',
      locations: [],
      title: 'Corrected title',
      compensation: [],
    },
    revisions: {},
    pending: null,
  };
  const corrected = toOpportunity({ ...item, edits });
  expect(corrected.companyName).toBe('Corrected company');
  expect(corrected.jobDetails?.company.website).toBe('https://example.test/');
  expect(corrected.posting).toMatchObject({
    title: 'Corrected title',
    location: null,
    salary: null,
  });
  expect(
    toOpportunity({ ...item, parsedPosting: null, edits }).posting?.title,
  ).toBe('Corrected title');
  expect(
    toOpportunity({
      ...item,
      parsedPosting: null,
      edits: { ...edits, overrides: {} },
    }).posting,
  ).toBeNull();
  expect(
    toOpportunity({
      ...item,
      edits: {
        ...edits,
        overrides: { companyName: null, companyWebsite: null },
      },
    }).jobDetails?.company,
  ).toEqual({ name: null, website: null });
});

it('preserves an explicit unassigned company without restoring extracted identity', () => {
  const item = postingFixtures()[0];
  const role = toOpportunity({
    ...item,
    companyAssociation: { company: null, mode: 'manual', revision: 1 },
  });
  expect(role.companyId).toBeNull();
  expect(role.companyName).toBeNull();
  expect(role.jobDetails?.company.name).toBe('Northstar');
});
