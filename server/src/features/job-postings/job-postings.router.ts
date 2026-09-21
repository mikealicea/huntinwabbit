import express, { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import type { AuthLocals } from '../auth/auth.index.ts';
import { postingError } from './job-postings.errors.ts';
import {
  deleteRequestSchema,
  extractionRequestSchema,
  type JobPostings,
  listRequestSchema,
  saveRequestSchema,
  updateRequestSchema,
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
  router.get(
    '/job-postings/:id',
    async (req: Request, res: Response<unknown, AuthLocals>) => {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) throw postingError('NOT_FOUND');
      if (!postings) throw postingError('STORAGE_DISABLED');
      res.json({
        schemaVersion: 1,
        item: await postings.get(
          res.locals.identity.userId,
          id.data,
          AbortSignal.timeout(10_000),
        ),
      });
    },
  );
  for (const operation of ['update', 'extract', 'delete'] as const) {
    const handler = async (
      req: Request,
      res: Response<unknown, AuthLocals>,
    ) => {
      if (!req.is('application/json')) {
        res.status(415).json({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Provide an application/json request body.',
        });
        return;
      }
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) throw postingError('NOT_FOUND');
      if (!postings) throw postingError('STORAGE_DISABLED');
      const signal = AbortSignal.timeout(10_000);
      if (operation === 'delete') {
        const input = deleteRequestSchema.safeParse(req.body);
        if (!input.success) throw postingError('INVALID_REQUEST');
        await postings.delete(
          res.locals.identity.userId,
          id.data,
          input.data.expectedApplicationVersion,
          signal,
        );
        res.status(204).end();
      } else if (operation === 'update') {
        const input = updateRequestSchema.safeParse(req.body);
        if (!input.success) throw postingError('INVALID_REQUEST');
        res.json({
          schemaVersion: 1,
          item: await postings.update(
            res.locals.identity.userId,
            id.data,
            input.data,
            signal,
          ),
        });
      } else {
        const input = extractionRequestSchema.safeParse(req.body);
        if (!input.success) throw postingError('INVALID_REQUEST');
        res.status(202).json({
          schemaVersion: 1,
          item: await postings.extract(
            res.locals.identity.userId,
            id.data,
            input.data.expectedGeneration,
            signal,
          ),
        });
      }
    };
    if (operation === 'update')
      router.patch(
        '/job-postings/:id',
        express.json({ limit: '256kb' }),
        handler,
      );
    else if (operation === 'delete')
      router.delete(
        '/job-postings/:id',
        express.json({ limit: '16kb' }),
        handler,
      );
    else
      router.post(
        '/job-postings/:id/extraction',
        express.json({ limit: '16kb' }),
        handler,
      );
  }
  return router;
}
