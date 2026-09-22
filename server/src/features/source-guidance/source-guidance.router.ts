import { json, Router } from 'express';
import { AppError } from '../../shared/shared.errors.ts';
import {
  guidanceRequestSchema,
  type SourceGuidance,
} from './source-guidance.schemas.ts';

export function createSourceGuidanceRouter(guidance?: SourceGuidance): Router {
  const router = Router();
  router.post(
    '/job-postings/source-guidance',
    json({ limit: '2kb' }),
    async (req, res) => {
      const input = guidanceRequestSchema.safeParse(req.body);
      if (!input.success || Object.keys(req.query).length)
        throw new AppError(400, 'Provide a valid hostname.', {
          code: 'INVALID_REQUEST',
        });
      if (!guidance)
        throw new AppError(503, 'Source guidance is temporarily unavailable.', {
          code: 'GUIDANCE_UNAVAILABLE',
        });
      res.json(await guidance.lookup(input.data.hostname));
    },
  );
  return router;
}
