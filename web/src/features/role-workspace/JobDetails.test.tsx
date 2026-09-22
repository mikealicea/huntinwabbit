/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { postingFixtures } from '@/features/job-api/job-api.test-support';
import { toOpportunity } from '@/features/job-search/job-search.index';
import { JobDetails } from './JobDetails.component';
import { PostingDescription } from './PostingDescription.component';

it('places role facts together before requirements, technologies, responsibilities and the full description', () => {
  const item = postingFixtures()[0];
  if (!item.parsedPosting) throw new Error('Missing fixture');
  item.parsedPosting.job.locations = ['New York', 'Boston'];
  item.parsedPosting.job.compensation.push({
    ...item.parsedPosting.job.compensation[0],
    location: 'Boston',
    originalText: 'Boston salary wording',
  });
  render(<JobDetails role={toOpportunity(item)} />);
  const overview = screen.getByLabelText('Job overview');
  for (const value of [
    'New York · Boston',
    'Full time',
    '170,000–210,000 USD / year',
    'Remote',
  ]) {
    expect(within(overview).getByText(value)).toBeVisible();
  }
  expect(
    screen.getAllByRole('heading').map((heading) => heading.textContent),
  ).toEqual([
    'Job details',
    'Requirements',
    'Preferred qualifications',
    'Tech stack',
    'Responsibilities',
    'Full job details',
    'About the role',
    'What you will do',
    'Our tools',
    'Compensation details',
  ]);
  expect(screen.getByText('TypeScript (required)')).toBeVisible();
  expect(screen.getByText('PostgreSQL (preferred)')).toBeVisible();
  expect(screen.getByText('GitHub Actions')).toBeVisible();
  expect(screen.getByText(/Boston salary wording/)).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'About the role', level: 4 }),
  ).toBeVisible();
});

it('keeps legacy descriptions readable and distinguishes unextracted technologies from empty results', () => {
  const item = postingFixtures()[1];
  if (!item.parsedPosting) throw new Error('Missing fixture');
  const job = item.parsedPosting.job;
  job.description =
    'First original line.\nSecond original line.\n\nAnother paragraph.';
  const view = render(<JobDetails role={toOpportunity(item)} />);
  expect(
    screen.getByText('Refresh the posting to extract technologies.'),
  ).toBeVisible();
  expect(screen.getByText(/First original line/).textContent).toBe(
    'First original line.\nSecond original line.',
  );
  expect(screen.getByText('Another paragraph.')).toBeVisible();
  job.technologies = [];
  job.locations = [];
  job.employmentType = null;
  job.compensation = [];
  job.requirements = [];
  job.description = null;
  view.rerender(<JobDetails role={toOpportunity(item)} />);
  for (const label of [
    'Location',
    'Employment type',
    'Salary',
    'Work arrangement',
    'Technologies',
    'Requirements',
    'Responsibilities',
    'Description',
  ]) {
    expect(screen.getByText(`${label} not listed`)).toBeVisible();
  }
  expect(
    screen.queryByText('Refresh the posting to extract technologies.'),
  ).not.toBeInTheDocument();
});

it('renders HTML as text and blocks embedded images and non-HTTP links', () => {
  const { container } = render(
    <PostingDescription
      description={
        '## Safe heading\n\n<script>alert(1)</script>\n\n![Tracking pixel](https://example.test/pixel)\n\n[Unsafe](javascript:alert%281%29) [Relative](/app) [Mail](mailto:test@example.test) [Credentials](https://user:password@example.test) [Safe](https://example.test/job)\n\n1. First\n2. Second'
      }
    />,
  );
  expect(container.querySelector('script, img, iframe')).toBeNull();
  expect(screen.getByText('<script>alert(1)</script>')).toBeVisible();
  expect(screen.getByText('Tracking pixel')).toBeVisible();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Safe (opens in a new tab)' }),
  ).toHaveAttribute('href', 'https://example.test/job');
  expect(screen.getByRole('link')).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  expect(screen.getByRole('list').tagName).toBe('OL');
});

it('renders effective corrections, including explicit technology clears, during a failed refresh', () => {
  const item = postingFixtures()[0];
  item.edits = {
    overrides: {
      technologies: [],
      description: '## My correction\n\nPreserve this wording.',
    },
    revisions: {},
    pending: null,
  };
  item.extraction.status = 'failed';
  render(<JobDetails role={toOpportunity(item)} />);
  expect(screen.getByRole('heading', { name: 'My correction' })).toBeVisible();
  expect(screen.getByText('Technologies not listed')).toBeVisible();
  expect(screen.queryByText('TypeScript (required)')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
