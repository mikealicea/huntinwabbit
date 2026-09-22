import { z } from 'zod';

export const noteBodySchema = z
  .string()
  .max(20_000)
  .refine((value) => value.trim().length > 0);
export const noteSchema = z.strictObject({
  id: z.uuid(),
  body: noteBodySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  revision: z.number().int().positive(),
});
export const createNoteSchema = z.strictObject({
  id: z.uuid(),
  body: noteBodySchema,
});
export const editNoteSchema = z.strictObject({
  body: noteBodySchema,
  expectedRevision: z.number().int().positive(),
});
export const deleteNoteSchema = editNoteSchema.omit({ body: true });
export const notesQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(2048).optional(),
});
export const notesPageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.array(noteSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const noteResultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: noteSchema,
});
export type RoleNote = z.infer<typeof noteSchema>;
