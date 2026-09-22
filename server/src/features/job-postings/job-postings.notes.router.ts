import { createNotesRouter } from '../../shared/shared.notes.router.ts';
import { postingError } from './job-postings.errors.ts';
import type { RoleNotes } from './job-postings.notes.ts';
export function createRoleNotesRouter(notes?: RoleNotes) {
  return createNotesRouter('/job-postings/:id/notes', postingError, notes);
}
