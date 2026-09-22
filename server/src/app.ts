import express from 'express';

import {
  requireAuthentication,
  type VerifyAccessToken,
} from './features/auth/auth.index.ts';
import { createHelloRouter } from './features/hello/hello.index.ts';
import {
  createJobParsingRouter,
  type ParsePosting,
} from './features/job-parsing/job-parsing.index.ts';
import {
  createJobPostingsRouter,
  createRoleNotesRouter,
  createRoleUpdatesRouter,
  type JobPostings,
  type RoleNotes,
  type RoleUpdates,
} from './features/job-postings/job-postings.index.ts';
import { errorMiddleware } from './shared/shared.errors.ts';
import { requestLogging } from './shared/shared.middleware.ts';

export function buildApp(dependencies: {
  verifyAccessToken: VerifyAccessToken;
  parsePosting?: ParsePosting;
  jobPostings?: JobPostings;
  roleUpdates?: RoleUpdates;
  roleNotes?: RoleNotes;
}): express.Express {
  const app = express();

  app.use(requestLogging);

  app.get('/health', (_req, res): void => {
    res.json({ message: 'ok' });
  });

  app.use(requireAuthentication(dependencies.verifyAccessToken));
  app.use(createRoleNotesRouter(dependencies.roleNotes));
  app.use(createRoleUpdatesRouter(dependencies.roleUpdates));
  app.use(createJobPostingsRouter(dependencies.jobPostings));
  app.use(express.json({ limit: '16kb' }));
  app.use(createHelloRouter());
  app.use(createJobParsingRouter(dependencies.parsePosting));

  app.use(errorMiddleware);

  return app;
}
