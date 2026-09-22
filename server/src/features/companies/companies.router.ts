import express, { type Response, Router } from 'express';
import { z } from 'zod';
import type { AuthLocals } from '../auth/auth.index.ts';
import type { PostingCompanies } from '../job-postings/job-postings.index.ts';
import {
  companyQuerySchema,
  companySelectionSchema,
} from './companies.schemas.ts';
import { type CompanyStore, companyError } from './companies.store.ts';
export function createCompaniesRouter(
  companies?: CompanyStore,
  postings?: PostingCompanies,
) {
  const router = Router();
  function available() {
    if (!companies || !postings) throw companyError('STORAGE_UNAVAILABLE');
    return { companies, postings };
  }
  router.get('/companies', async (req, res: Response<unknown, AuthLocals>) => {
    const input = companyQuerySchema.safeParse(req.query);
    if (!input.success) throw companyError('INVALID_REQUEST');
    res.json({
      schemaVersion: 1,
      ...(await available().companies.list(
        `USER#${res.locals.identity.userId}`,
        input.data,
        AbortSignal.timeout(10_000),
      )),
    });
  });
  router.get(
    '/companies/:id',
    async (req, res: Response<unknown, AuthLocals>) => {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) throw companyError('NOT_FOUND');
      if (Object.keys(req.query).length) throw companyError('INVALID_REQUEST');
      res.json({
        schemaVersion: 1,
        item: await available().companies.get(
          `USER#${res.locals.identity.userId}`,
          id.data,
          AbortSignal.timeout(10_000),
        ),
      });
    },
  );
  router.get(
    '/companies/:id/roles',
    async (req, res: Response<unknown, AuthLocals>) => {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) throw companyError('NOT_FOUND');
      const input = companyQuerySchema.omit({ q: true }).safeParse(req.query);
      if (!input.success) throw companyError('INVALID_REQUEST');
      res.json(
        await available().postings.roles(
          res.locals.identity.userId,
          id.data,
          input.data,
          AbortSignal.timeout(10_000),
        ),
      );
    },
  );
  router.patch(
    '/job-postings/:id/company',
    express.json({ limit: '16kb' }),
    async (req, res: Response<unknown, AuthLocals>) => {
      if (!req.is('application/json')) {
        res.status(415).json({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Provide an application/json request body.',
        });
        return;
      }
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) throw companyError('NOT_FOUND');
      const input = companySelectionSchema.safeParse(req.body);
      if (!input.success || Object.keys(req.query).length)
        throw companyError('INVALID_REQUEST');
      res.json({
        schemaVersion: 1,
        item: await available().postings.select(
          res.locals.identity.userId,
          id.data,
          input.data,
          AbortSignal.timeout(10_000),
        ),
      });
    },
  );
  return router;
}
