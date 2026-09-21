import express, { type Response, Router } from 'express';
import { z } from 'zod';
import type { AuthLocals } from '../auth/auth.index.ts';
import { postingError } from './job-postings.errors.ts';
import {
  historyQuerySchema,
  updateMessageSchema,
} from './job-postings.updates.schemas.ts';
import type { RoleUpdates } from './job-postings.updates.ts';
export function createRoleUpdatesRouter(updates?: RoleUpdates) {
  const router = Router();
  const path = '/job-postings/:id/updates';
  router.get(path, async (req, res: Response<unknown, AuthLocals>) => {
    if (!updates) throw postingError('STORAGE_DISABLED');
    const id = z.uuid().safeParse(req.params.id);
    const query = historyQuerySchema.safeParse(req.query);
    if (!id.success) throw postingError('NOT_FOUND');
    if (!query.success) throw postingError('INVALID_REQUEST');
    res.json(
      await updates.history(res.locals.identity.userId, id.data, query.data),
    );
  });
  for (const undo of [false, true])
    router.post(
      undo ? `${path}/:operation/undo` : path,
      express.json({ limit: '128kb' }),
      async (req, res: Response<unknown, AuthLocals>) => {
        if (!req.is('application/json')) {
          res
            .status(415)
            .json({ message: 'Provide an application/json request body.' });
          return;
        }
        if (!updates) throw postingError('STORAGE_DISABLED');
        const id = z.uuid().safeParse(req.params.id);
        if (!id.success) throw postingError('NOT_FOUND');
        if (undo) {
          const operation = z
            .uuid()
            .safeParse(
              'operation' in req.params ? req.params.operation : undefined,
            );
          if (
            !operation.success ||
            !z.strictObject({}).safeParse(req.body).success
          )
            throw postingError('INVALID_REQUEST');
          res.json({
            schemaVersion: 1,
            entry: await updates.undo(
              res.locals.identity.userId,
              id.data,
              operation.data,
            ),
          });
        } else {
          const input = updateMessageSchema.safeParse(req.body);
          if (!input.success) throw postingError('INVALID_REQUEST');
          res.status(202).json({
            schemaVersion: 1,
            entry: await updates.submit(
              res.locals.identity.userId,
              id.data,
              input.data,
            ),
          });
        }
      },
    );
  return router;
}
