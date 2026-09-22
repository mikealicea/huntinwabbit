export interface Note {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export type NoteOutcome = 'saved' | 'conflict' | 'failed';
