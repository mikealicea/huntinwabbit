import { describe, expect, it } from 'vitest';
import { validateCapture } from './job-capture.validation';

describe('capture validation', () => {
  it('ignores blank rows and preserves each link’s interest', () => {
    expect(
      validateCapture([
        {
          id: 1,
          url: ' https://example.com/jobs/1 ',
          interest: 'highly-interested',
        },
        { id: 2, url: '', interest: 'not-set' },
        { id: 3, url: 'http://example.org/role', interest: 'throwaway' },
      ]),
    ).toEqual({
      links: [
        {
          sourceUrl: 'https://example.com/jobs/1',
          interest: 'highly-interested',
        },
        { sourceUrl: 'http://example.org/role', interest: 'throwaway' },
      ],
      errors: {},
    });
  });

  it.each([
    'javascript:alert(1)',
    'file:///tmp/job',
    'not a link',
    'https://name:password@example.com',
  ])('rejects unsafe or invalid URL %s', (url) => {
    expect(
      validateCapture([{ id: 7, url, interest: 'not-set' }]).errors[7],
    ).toBeTruthy();
  });

  it('requires at least one link', () => {
    expect(
      validateCapture([{ id: 0, url: '  ', interest: 'not-set' }]).errors[0],
    ).toBe('Paste at least one job link.');
  });
});

it('requires a URL for pasted text and rejects character and UTF-8 overflows', () => {
  expect(
    validateCapture([
      { id: 0, url: '', interest: 'not-set', sourceText: 'Posting' },
    ]).errors[0],
  ).toContain('Enter a job link');
  for (const text of ['x'.repeat(100_001), '漢'.repeat(90_000)])
    expect(
      validateCapture([
        {
          id: 0,
          url: 'example.test/job',
          interest: 'not-set',
          sourceText: text,
        },
      ]).errors[0],
    ).toContain('Shorten');
});
