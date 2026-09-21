import express, { type Request, type Response, Router } from 'express';
import type { AuthLocals } from '../auth/auth.index.ts';
import { postingError } from './job-postings.errors.ts';
import {
  type JobPostings,
  listRequestSchema,
  saveRequestSchema,
} from './job-postings.schemas.ts';

export function createJobPostingsRouter(postings?: JobPostings): Router {
  const router = Router();
  router
    .route('/job-postings')
    .get(async (req: Request, res: Response<unknown, AuthLocals>) => {
      const input = listRequestSchema.safeParse(req.query);
      if (!input.success) throw postingError('INVALID_REQUEST');
      if (!postings) throw postingError('STORAGE_DISABLED');
      const { identity } = res.locals;
      res.json(
        await postings.list(
          identity.userId,
          input.data,
          AbortSignal.timeout(10_000),
        ),
      );
    })
    .post(
      express.json({ limit: '256kb' }),
      async (req: Request, res: Response<unknown, AuthLocals>) => {
        if (!req.is('application/json')) {
          res.status(415).json({
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Provide an application/json request body.',
          });
          return;
        }
        const input = saveRequestSchema.safeParse(req.body);
        if (!input.success) throw postingError('INVALID_REQUEST');
        if (!postings) throw postingError('STORAGE_DISABLED');
        const { identity } = res.locals;
        const result = await postings.save(
          identity.userId,
          input.data,
          AbortSignal.timeout(10_000),
        );
        res.status(result.created ? 201 : 200).json(result);
      },
    );
  return router;
}
