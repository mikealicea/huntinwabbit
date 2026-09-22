import express, { type Response, Router } from 'express';
import { z } from 'zod';
import type { AuthLocals } from '../auth/auth.index.ts';
import {
  analysisQuerySchema,
  analysisRequestSchema,
} from './company-analysis.schemas.ts';
import {
  analysisError,
  type CompanyAnalysis,
} from './company-analysis.store.ts';
export function createCompanyAnalysisRouter(analysis?: CompanyAnalysis) {
  const router = Router();
  router
    .route('/companies/:id/analysis')
    .get(async (req, res: Response<unknown, AuthLocals>) => {
      const id = z.uuid().safeParse(req.params.id),
        query = analysisQuerySchema.safeParse(req.query);
      if (!id.success) throw analysisError('NOT_FOUND', 404);
      if (!query.success) throw analysisError('INVALID_REQUEST', 400);
      if (!analysis) throw analysisError('STORAGE_UNAVAILABLE');
      res.json(
        await analysis.get(
          `USER#${res.locals.identity.userId}`,
          id.data,
          query.data.cursor,
        ),
      );
    })
    .post(
      express.json({ limit: '4kb' }),
      async (req, res: Response<unknown, AuthLocals>) => {
        const id = z.uuid().safeParse(req.params.id),
          input = analysisRequestSchema.safeParse(req.body);
        if (!id.success) throw analysisError('NOT_FOUND', 404);
        if (!req.is('application/json'))
          throw analysisError('UNSUPPORTED_MEDIA_TYPE', 415);
        if (!input.success || Object.keys(req.query).length)
          throw analysisError('INVALID_REQUEST', 400);
        if (!analysis) throw analysisError('STORAGE_UNAVAILABLE');
        res
          .status(202)
          .json(
            await analysis.request(
              `USER#${res.locals.identity.userId}`,
              id.data,
              input.data,
            ),
          );
      },
    );
  return router;
}
