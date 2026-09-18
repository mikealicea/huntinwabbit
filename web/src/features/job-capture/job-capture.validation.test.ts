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
