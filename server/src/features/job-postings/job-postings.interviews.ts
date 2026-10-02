import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  type InterviewProcess,
  interviewProcessSchema,
} from './job-postings.schemas.ts';

// The model uses temporary references for new stages; only the server creates IDs.
export const modelInterviewProcessSchema = z
  .strictObject({
    stages: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(120),
          name: z.string().trim().min(1).max(120),
        }),
      )
      .min(1)
      .max(20),
    currentStageId: z.string().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.stages.map((stage) => stage.id)).size !==
      value.stages.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Duplicate stage references.',
      });
    if (
      value.currentStageId &&
      !value.stages.some((stage) => stage.id === value.currentStageId)
    )
      context.addIssue({ code: 'custom', message: 'Unknown current stage.' });
  });

export function normalizeInterviewProcess(
  value: unknown,
  previous: InterviewProcess | null | undefined,
  newId: () => string = randomUUID,
): InterviewProcess | null {
  if (value === null) return null;
  const proposed = modelInterviewProcessSchema.parse(value);
  const stages = proposed.stages.map((stage) => {
    const existing =
      previous?.stages.find((old) => old.id === stage.id) ??
      previous?.stages.find((old) => old.name === stage.name);
    return { id: existing?.id ?? newId(), name: stage.name };
  });
  const selected = proposed.stages.findIndex(
    (stage) => stage.id === proposed.currentStageId,
  );
  return interviewProcessSchema.parse({
    stages,
    currentStageId:
      proposed.currentStageId === undefined
        ? (stages.find((stage) => stage.id === previous?.currentStageId)?.id ??
          null)
        : selected >= 0
          ? stages[selected]?.id
          : null,
  });
}
