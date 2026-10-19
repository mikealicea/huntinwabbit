import { strToU8, zipSync } from 'fflate';
import type { PrepDocument } from './role-workspace.prep';

export function buildPrepArchive(documents: readonly PrepDocument[]): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const document of documents) {
    entries[document.filename] = strToU8(document.markdown);
  }
  const archive = zipSync(entries, { level: 0 });
  return new Blob([archive], { type: 'application/zip' });
}
