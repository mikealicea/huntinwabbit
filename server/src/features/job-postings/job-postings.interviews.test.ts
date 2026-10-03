import { describe, expect, it } from 'vitest';
import { normalizeInterviewProcess } from './job-postings.interviews.ts';
import { interviewProcessSchema } from './job-postings.schemas.ts';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const previous = { stages: [{ id, name: 'Recruiter' }], currentStageId: id };
describe('interview process integrity', () => {
  it('keeps known identities and position even when the model supplies a fresh reference for the same name', () => {
    expect(
      normalizeInterviewProcess(
        { stages: [{ id: 'new', name: 'Recruiter' }] },
        previous,
      ),
    ).toEqual(previous);
  });
  it('uses explicit unknown position and supports clearing', () => {
    expect(
      normalizeInterviewProcess({ ...previous, currentStageId: null }, previous)
        ?.currentStageId,
    ).toBeNull();
    expect(normalizeInterviewProcess(null, previous)).toBeNull();
  });
  it('rejects duplicate identities and dangling selections', () => {
    expect(() =>
      normalizeInterviewProcess(
        {
          stages: [
            { id: 'a', name: 'A' },
            { id: 'a', name: 'B' },
          ],
          currentStageId: null,
        },
        null,
      ),
    ).toThrow();
    expect(() =>
      normalizeInterviewProcess(
        { stages: [{ id: 'a', name: 'A' }], currentStageId: 'b' },
        null,
      ),
    ).toThrow();
    expect(
      interviewProcessSchema.safeParse({
        stages: [previous.stages[0], previous.stages[0]],
        currentStageId: id,
      }).success,
    ).toBe(false);
    expect(
      interviewProcessSchema.safeParse({
        ...previous,
        currentStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }).success,
    ).toBe(false);
  });
});

it('keeps stage context when omitted by a later model update and accepts explicit corrections', () => {
  const known = {
    ...previous,
    stages: [
      {
        id,
        name: 'Recruiter',
        context: '45 minutes with the hiring manager. Prepare questions.',
      },
    ],
  };
  expect(
    normalizeInterviewProcess(
      { stages: [{ id, name: 'Hiring manager' }] },
      known,
    )?.stages[0],
  ).toEqual({ ...known.stages[0], name: 'Hiring manager' });
  expect(
    normalizeInterviewProcess(
      {
        stages: [
          {
            id,
            name: 'Hiring manager',
            context: '60 minutes. Prepare questions.',
          },
        ],
      },
      known,
    )?.stages[0]?.context,
  ).toBe('60 minutes. Prepare questions.');
  expect(
    normalizeInterviewProcess(
      { stages: [{ id, name: 'Recruiter', context: '' }] },
      known,
    )?.stages[0]?.context,
  ).toBe('');
  expect(() =>
    normalizeInterviewProcess(
      { stages: [{ id, name: 'Recruiter', context: 'x'.repeat(4001) }] },
      known,
    ),
  ).toThrow();
});
