import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import type { PrepContext } from '@/features/job-api/job-api.index';
import { formatPrepMaterials } from './role-workspace.prep';
import { buildPrepArchive } from './role-workspace.prep-archive';

it('packages exactly the three formatted UTF-8 documents as flat stored ZIP entries with byte-identical content', async () => {
  const timestamp = '2026-10-19T12:00:00.000Z';
  const stageId = '00000000-0000-4000-8000-000000000001';
  const codingMaterial =
    '  Bonjour, 世界 🐇\n```typescript\nconst answer = `<div>42</div>`;\n```\n`````\nTrailing spaces remain.  \n';
  const context: PrepContext = {
    stageId,
    startedAt: timestamp,
    completedAt: timestamp,
    posting: {
      id: '00000000-0000-4000-8000-000000000002',
      sourceUrl: 'https://example.test/fictional-job',
      createdAt: timestamp,
      updatedAt: timestamp,
      applicationVersion: 0,
      recordVersion: 0,
      extraction: { status: 'not-requested', generation: null, error: null },
      parsedPosting: null,
      application: {
        stage: 'interviewing',
        interest: 'not-set',
        priority: 'not-set',
        followUpOn: null,
        notes: '',
        interviewProcess: {
          stages: [
            { id: stageId, name: 'Coding exercise', context: codingMaterial },
          ],
          currentStageId: stageId,
        },
      },
    },
    source: {
      schemaVersion: 1,
      source: {
        text: codingMaterial,
        sourceUrl: 'https://example.test/fictional-job',
        revision: stageId,
        updatedAt: timestamp,
      },
      applicationVersion: 0,
      generation: null,
    },
    roleNotes: [],
    updates: [],
    company: null,
  };
  const materials = formatPrepMaterials(context);
  const blob = buildPrepArchive(materials.documents);
  expect(blob.type).toBe('application/zip');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = unzipSync(bytes);
  expect(Object.keys(entries)).toEqual([
    'job-listing.md',
    'company-context.md',
    'role-context.md',
  ]);
  for (const document of materials.documents) {
    expect(entries[document.filename]).toEqual(
      new TextEncoder().encode(document.markdown),
    );
    expect(strFromU8(entries[document.filename])).toBe(document.markdown);
  }
  expect(strFromU8(entries['job-listing.md'])).toContain(codingMaterial);
  expect(strFromU8(entries['role-context.md'])).toContain(codingMaterial);

  // Inspect local entry headers as well as decoding: these must be stored, not compressed.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  for (const document of materials.documents) {
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const size = view.getUint32(offset + 18, true);
    expect(view.getUint32(offset + 22, true)).toBe(size);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    expect(
      strFromU8(bytes.subarray(offset + 30, offset + 30 + nameLength)),
    ).toBe(document.filename);
    offset += 30 + nameLength + extraLength + size;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
});
