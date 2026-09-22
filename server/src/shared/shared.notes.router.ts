import express, { type Response, Router } from 'express';
import { z } from 'zod';
import {
  createNoteSchema,
  deleteNoteSchema,
  editNoteSchema,
  notesQuerySchema,
} from './shared.notes.schemas.ts';
import type { NotesStore } from './shared.notes.ts';

export function createNotesRouter(
  path: string,
  noteError: (
    code: 'STORAGE_DISABLED' | 'NOT_FOUND' | 'INVALID_REQUEST',
  ) => Error,
  notes?: NotesStore,
) {
  const router = Router();
  router.get(
    path,
    async (req, res: Response<unknown, { identity: { userId: string } }>) => {
      if (!notes) throw noteError('STORAGE_DISABLED');
      const id = z.uuid().safeParse(req.params.id);
      const query = notesQuerySchema.safeParse(req.query);
      if (!id.success) throw noteError('NOT_FOUND');
      if (!query.success) throw noteError('INVALID_REQUEST');
      res.json(
        await notes.list(res.locals.identity.userId, id.data, query.data),
      );
    },
  );
  for (const method of ['post', 'patch', 'delete'] as const)
    router[method](
      method === 'post' ? path : `${path}/:noteId`,
      express.json({ limit: '128kb' }),
      async (req, res: Response<unknown, { identity: { userId: string } }>) => {
        if (!req.is('application/json')) {
          res
            .status(415)
            .json({ message: 'Provide an application/json request body.' });
          return;
        }
        if (!notes) throw noteError('STORAGE_DISABLED');
        const id = z.uuid().safeParse(req.params.id);
        const noteId = z
          .uuid()
          .safeParse('noteId' in req.params ? req.params.noteId : undefined);
        if (!id.success || (method !== 'post' && !noteId.success))
          throw noteError('NOT_FOUND');
        const user = res.locals.identity.userId;
        if (method === 'post') {
          const input = createNoteSchema.safeParse(req.body);
          if (!input.success) throw noteError('INVALID_REQUEST');
          res.status(201).json({
            schemaVersion: 1,
            note: await notes.create(user, id.data, input.data),
          });
        } else if (method === 'patch' && noteId.success) {
          const input = editNoteSchema.safeParse(req.body);
          if (!input.success) throw noteError('INVALID_REQUEST');
          res.json({
            schemaVersion: 1,
            note: await notes.edit(user, id.data, noteId.data, input.data),
          });
        } else if (noteId.success) {
          const input = deleteNoteSchema.safeParse(req.body);
          if (!input.success) throw noteError('INVALID_REQUEST');
          await notes.delete(user, id.data, noteId.data, input.data);
          res.status(204).end();
        }
      },
    );
  return router;
}
