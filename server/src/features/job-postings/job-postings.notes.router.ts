import express, { type Response, Router } from 'express';
import { z } from 'zod';
import type { AuthLocals } from '../auth/auth.index.ts';
import { postingError } from './job-postings.errors.ts';
import {
  createNoteSchema,
  deleteNoteSchema,
  editNoteSchema,
  notesQuerySchema,
} from './job-postings.notes.schemas.ts';
import type { RoleNotes } from './job-postings.notes.ts';

export function createRoleNotesRouter(notes?: RoleNotes) {
  const router = Router();
  const path = '/job-postings/:id/notes';
  router.get(path, async (req, res: Response<unknown, AuthLocals>) => {
    if (!notes) throw postingError('STORAGE_DISABLED');
    const id = z.uuid().safeParse(req.params.id);
    const query = notesQuerySchema.safeParse(req.query);
    if (!id.success) throw postingError('NOT_FOUND');
    if (!query.success) throw postingError('INVALID_REQUEST');
    res.json(await notes.list(res.locals.identity.userId, id.data, query.data));
  });
  for (const method of ['post', 'patch', 'delete'] as const)
    router[method](
      method === 'post' ? path : `${path}/:noteId`,
      express.json({ limit: '128kb' }),
      async (req, res: Response<unknown, AuthLocals>) => {
        if (!req.is('application/json')) {
          res
            .status(415)
            .json({ message: 'Provide an application/json request body.' });
          return;
        }
        if (!notes) throw postingError('STORAGE_DISABLED');
        const id = z.uuid().safeParse(req.params.id);
        const noteId = z
          .uuid()
          .safeParse('noteId' in req.params ? req.params.noteId : undefined);
        if (!id.success || (method !== 'post' && !noteId.success))
          throw postingError('NOT_FOUND');
        const user = res.locals.identity.userId;
        if (method === 'post') {
          const input = createNoteSchema.safeParse(req.body);
          if (!input.success) throw postingError('INVALID_REQUEST');
          res.status(201).json({
            schemaVersion: 1,
            note: await notes.create(user, id.data, input.data),
          });
        } else if (method === 'patch' && noteId.success) {
          const input = editNoteSchema.safeParse(req.body);
          if (!input.success) throw postingError('INVALID_REQUEST');
          res.json({
            schemaVersion: 1,
            note: await notes.edit(user, id.data, noteId.data, input.data),
          });
        } else if (noteId.success) {
          const input = deleteNoteSchema.safeParse(req.body);
          if (!input.success) throw postingError('INVALID_REQUEST');
          await notes.delete(user, id.data, noteId.data, input.data);
          res.status(204).end();
        }
      },
    );
  return router;
}
