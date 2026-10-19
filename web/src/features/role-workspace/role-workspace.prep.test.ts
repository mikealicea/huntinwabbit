import { describe, expect, it } from 'vitest';
import type {
  PrepContext,
  RoleNote,
  UpdateEntry,
} from '@/features/job-api/job-api.index';
import { formatPrepMaterials } from './role-workspace.prep';

const startedAt = '2026-10-18T23:59:58.000Z';
const completedAt = '2026-10-19T00:00:02.000Z';
const currentId = '00000000-0000-4000-8000-000000000001';
const selectedId = '00000000-0000-4000-8000-000000000002';
const laterId = '00000000-0000-4000-8000-000000000003';
const removedId = '00000000-0000-4000-8000-000000000004';
const companyId = '00000000-0000-4000-8000-000000000005';
const roleId = '00000000-0000-4000-8000-000000000006';
const retainedText =
  '  From: recruiter@example.test\n# Listing source only\n```ts\nconst greeting = "你好 🐇";\n```\n`````\n<div>Do not execute</div>\n  ';
const roleEmail =
  'From: hiring@example.test\nSubject: Company strategy\n\nThe employer sells fictional widgets.\n```html\n<strong>Prepare an algorithm</strong>\n```\nKeep this entire company-related email together.\n';

function note(
  id: string,
  body: string,
  interviewStageId?: string | null,
): RoleNote {
  return {
    id,
    body,
    interviewStageId,
    createdAt: startedAt,
    updatedAt: completedAt,
    revision: 3,
  };
}

function richContext(): PrepContext {
  const entry: UpdateEntry = {
    id: '00000000-0000-4000-8000-000000000030',
    createdAt: startedAt,
    text: 'Original update email: all the interview instructions.\n```ts\nreturn 42;\n```',
    intent: 'interview-process',
    status: 'partial',
    changes: [
      {
        field: 'interviewProcess',
        before: null,
        after: {
          stages: [
            {
              id: selectedId,
              name: 'Exercise',
              context: 'Nested receipt coding instructions',
            },
          ],
          currentStageId: null,
        },
      },
    ],
    skipped: ['Skipped message remains whole\nincluding the second line.'],
    error: null,
    undoneAt: completedAt,
  };
  return {
    startedAt,
    completedAt,
    stageId: selectedId,
    posting: {
      id: roleId,
      sourceUrl: 'https://listing.example.test/current',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: startedAt,
      stageEnteredAt: '2026-10-01T00:00:00.000Z',
      applicationVersion: 7,
      recordVersion: 9,
      application: {
        stage: 'interviewing',
        interest: 'highly-interested',
        priority: 'high',
        followUpOn: '2026-10-20',
        notes: '  Legacy note only\nKeep spacing.  ',
        interviewProcess: {
          currentStageId: currentId,
          stages: [
            {
              id: currentId,
              name: 'Recruiter screen',
              context: 'Prior stage context only',
            },
            {
              id: selectedId,
              name: 'Coding / Exercise',
              context:
                'Selected coding instructions only\n```ts\nfunction solve() {}\n```',
            },
            {
              id: laterId,
              name: 'Final panel',
              context: 'Later stage context only',
            },
          ],
        },
      },
      companyAssociation: {
        company: {
          id: companyId,
          name: 'Saved Company',
          website: 'https://company.example.test/',
        },
        mode: 'manual',
        revision: 2,
      },
      extraction: {
        status: 'failed',
        error: 'Saved extraction failure',
        generation: roleId,
      },
      edits: {
        overrides: {
          title: 'Effective engineer',
          companyName: null,
          companyWebsite: null,
          requirements: [],
          description: null,
        },
        revisions: { title: 1, companyName: 2 },
        pending: 'pending-update-operation',
      },
      parsedPosting: {
        schemaVersion: 1,
        source: {
          normalizedUrl: 'https://listing.example.test/extracted',
          fetchedAt: null,
          extractedAt: startedAt,
          inputs: ['pasted-text'],
          fetchWarning: 'FETCH_UNAVAILABLE',
        },
        warnings: ['MISSING_COMPENSATION'],
        job: {
          title: 'Superseded extracted title',
          company: {
            name: 'Superseded source company',
            website: 'https://old-company.example.test/',
          },
          description: 'Superseded description only',
          locations: ['London', 'Remote UK'],
          employmentType: 'Full-time',
          workArrangement: 'remote',
          responsibilities: ['Own reliable systems'],
          requirements: ['Superseded requirement only'],
          preferredQualifications: ['Preferred qualification only'],
          technologies: ['TypeScript (required)', 'Rust (preferred)'],
          benefits: ['Fictional pension benefit'],
          compensation: [
            {
              kind: 'base',
              minimum: 100000,
              maximum: 120000,
              currency: 'GBP',
              period: 'year',
              location: 'London',
              originalText: 'Original base pay text only',
            },
            {
              kind: 'equity',
              minimum: null,
              maximum: null,
              currency: null,
              period: 'one-time',
              location: null,
              originalText: 'Original equity text only\nVests over four years',
            },
          ],
          postingId: 'external-posting-123',
          publishedDate: '2026-09-01',
          closingDate: '2026-11-01',
        },
      },
    },
    source: {
      schemaVersion: 1,
      source: {
        text: retainedText,
        sourceUrl: 'https://listing.example.test/previous',
        revision: removedId,
        updatedAt: startedAt,
      },
      applicationVersion: 7,
      generation: null,
    },
    roleNotes: [
      note(
        '00000000-0000-4000-8000-000000000012',
        'Target note second by ID',
        selectedId,
      ),
      note(
        '00000000-0000-4000-8000-000000000011',
        'Target note first by ID',
        selectedId,
      ),
      note(
        '00000000-0000-4000-8000-000000000013',
        'Prior interview note only',
        currentId,
      ),
      note('00000000-0000-4000-8000-000000000014', roleEmail, null),
      note(
        '00000000-0000-4000-8000-000000000015',
        'Removed-stage note only',
        removedId,
      ),
      note(
        '00000000-0000-4000-8000-000000000016',
        'Later-stage note only',
        laterId,
      ),
      note(
        '00000000-0000-4000-8000-000000000017',
        'Legacy unassigned comment only',
      ),
    ],
    updates: [
      {
        ...entry,
        id: '00000000-0000-4000-8000-000000000032',
        text: 'Failed original update only',
        status: 'failed',
        retryOf: entry.id,
        undoneAt: null,
        error: 'Saved update error only',
        changes: [],
      },
      {
        ...entry,
        id: '00000000-0000-4000-8000-000000000031',
        text: 'Pending original update only',
        status: 'processing',
        undoneAt: null,
        changes: [],
      },
      entry,
      {
        ...entry,
        id: '00000000-0000-4000-8000-000000000033',
        createdAt: '2026-09-01T00:00:00.000Z',
        text: 'Oldest original update only',
        status: 'applied',
        undoneAt: null,
        changes: [
          { field: 'description', before: 'Old value', after: 'New value' },
        ],
      },
    ],
    company: {
      details: {
        id: companyId,
        name: 'Saved Company',
        website: 'https://company.example.test/',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: startedAt,
      },
      notes: [
        note(
          '00000000-0000-4000-8000-000000000022',
          'Company note second only',
        ),
        note('00000000-0000-4000-8000-000000000021', 'Company note first only'),
      ],
      analysis: {
        schemaVersion: 1,
        status: 'failed',
        stale: true,
        generation: selectedId,
        totalRoles: 8,
        analyzedRoles: 7,
        completedAt: '2026-10-17T00:00:00.000Z',
        scheduledFor: startedAt,
        progress: 6,
        error: 'Saved analysis error only',
        items: [
          {
            category: 'technology',
            label: 'Saved generated finding only',
            qualifier: 'preferred',
            explanation: 'Generated explanation only',
            evidence: [
              {
                source: 'posting',
                roleId: removedId,
                roleTitle: 'Other saved role title',
                excerpt: 'Posting evidence excerpt only',
              },
              {
                source: 'personal',
                roleId,
                roleTitle: 'Effective engineer',
                excerpt: 'Personal evidence excerpt only',
              },
              {
                source: 'history',
                roleId,
                roleTitle: 'Effective engineer',
                excerpt: 'Historical evidence excerpt only',
              },
              {
                source: 'correction',
                roleId,
                roleTitle: 'Effective engineer',
                excerpt: 'Correction evidence excerpt only',
              },
              {
                source: 'company-comment',
                companyId,
                noteId: laterId,
                excerpt: 'Company comment evidence excerpt only',
              },
            ],
          },
        ],
      },
    },
  };
}

function documentTexts(context: PrepContext) {
  const materials = formatPrepMaterials(context);
  return {
    materials,
    listing: materials.documents[0].markdown,
    company: materials.documents[1].markdown,
    role: materials.documents[2].markdown,
  };
}

function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

describe('formatPrepMaterials', () => {
  it('creates exactly three individually understandable documents with saved-source ownership boundaries', () => {
    const context = richContext();
    const { materials, listing, company, role } = documentTexts(context);
    expect(materials.documents.map(({ filename }) => filename)).toEqual([
      'job-listing.md',
      'company-context.md',
      'role-context.md',
    ]);
    expect(
      materials.documents.map((document) => document.downloadFilename),
    ).toEqual([
      'saved-company-effective-engineer-job-listing.md',
      'saved-company-effective-engineer-company-context.md',
      'saved-company-effective-engineer-role-context.md',
    ]);
    for (const document of materials.documents) {
      expect(document.markdown).toContain(context.posting.id);
      expect(document.markdown).toContain('Effective engineer');
      expect(document.markdown).toContain('Saved Company');
      expect(document.markdown).toContain('Coding / Exercise');
      expect(document.markdown).toContain(startedAt);
      expect(document.markdown).toContain(completedAt);
      expect(document.markdown).toContain('not an atomic snapshot');
      for (const limitation of [
        'Unsaved drafts',
        'deleted comments',
        'previous comment revisions',
      ])
        expect(document.markdown).toContain(limitation);
      for (const companion of materials.documents.filter(
        (entry) => entry.filename !== document.filename,
      ))
        expect(document.markdown).toContain(companion.filename);
      expect(document.markdown.endsWith('\n')).toBe(true);
    }
    const ownership = [
      [
        listing,
        [company, role],
        [
          retainedText,
          'Original base pay text only',
          'Preferred qualification only',
          'Superseded description only',
        ],
      ],
      [
        company,
        [listing, role],
        [
          'Company note first only',
          'Saved generated finding only',
          'Company comment evidence excerpt only',
        ],
      ],
      [
        role,
        [listing, company],
        [
          roleEmail,
          'Target note first by ID',
          'Prior interview note only',
          'Removed-stage note only',
          'Later-stage note only',
          'Legacy unassigned comment only',
          'Oldest original update only',
          'Legacy note only',
        ],
      ],
    ] as const;
    for (const [owner, others, bodies] of ownership) {
      for (const body of bodies) {
        expect(owner).toContain(body);
        for (const other of others) expect(other).not.toContain(body);
      }
    }
    expect(listing).not.toContain('pending-update-operation');
    expect(company.indexOf('Company note first only')).toBeLessThan(
      company.indexOf('Company note second only'),
    );
    expect(company.indexOf('Company note second only')).toBeLessThan(
      company.indexOf('Saved generated finding only'),
    );
  });

  it('retains all effective fields, honest clears, full provenance and only superseded extracted fields', () => {
    const { listing } = documentTexts(richContext());
    const current = section(listing, 'Current job listing');
    for (const expected of [
      'Effective engineer',
      'London',
      'Remote UK',
      'Full-time',
      'remote',
      'Own reliable systems',
      'Preferred qualification only',
      'TypeScript (required)',
      'Rust (preferred)',
      'Fictional pension benefit',
      'Original base pay text only',
      'Original equity text only\nVests over four years',
      '100000',
      '120000',
      'GBP',
      'year',
      'one-time',
      'external-posting-123',
      '2026-09-01',
      '2026-11-01',
    ])
      expect(current).toContain(expected);
    for (const original of [
      'Superseded source company',
      'https://old-company.example.test/',
      'Superseded extracted title',
      'Superseded description only',
      'Superseded requirement only',
    ]) {
      expect(current).not.toContain(original);
      expect(section(listing, 'Superseded extracted values')).toContain(
        original,
      );
    }
    expect(current).toMatch(/\*\*Full description\*\*\s+Unknown/);
    expect(current).toMatch(/\*\*Requirements\*\*\s+None saved/);
    expect(current).toMatch(/\*\*Source-derived company name\*\*\s+Unknown/);
    expect(section(listing, 'Superseded extracted values')).not.toContain(
      'Original base pay text only',
    );
    const provenance = section(listing, 'Listing provenance');
    for (const expected of [
      '2026-09-01T00:00:00.000Z',
      startedAt,
      'failed',
      'Saved extraction failure',
      'https://listing.example.test/extracted',
      'pasted-text',
      'FETCH_UNAVAILABLE',
      'MISSING_COMPENSATION',
      'companyName',
      'companyWebsite',
      'description',
      'requirements',
    ])
      expect(provenance).toContain(expected);
    const retained = section(listing, 'Original pasted listing text');
    for (const expected of [
      retainedText,
      'https://listing.example.test/previous',
      removedId,
      startedAt,
      'Source URL mismatch',
    ])
      expect(retained).toContain(expected);
    expect(retained).toContain(`\`\`\`\`\`\`\n${retainedText}\n\`\`\`\`\`\``);
  });

  it('puts the non-current prep target first and includes every note once without inferring completed steps', () => {
    const context = richContext();
    const original = JSON.stringify(context);
    const { role } = documentTexts(context);
    expect(JSON.stringify(context)).toBe(original);
    const target = section(role, 'Preparation target');
    expect(target).toContain('Selected coding instructions only');
    expect(target).toMatch(/\*\*Current stage\*\*\s+```json\nfalse/);
    expect(target).toMatch(/\*\*Position in saved process\*\*\s+```json\n2/);
    expect(target).toContain('does not establish completed interviews');
    expect(target.indexOf('Target note first by ID')).toBeLessThan(
      target.indexOf('Target note second by ID'),
    );
    const others = section(role, 'Other interview steps');
    expect(others).not.toContain('Selected coding instructions only');
    expect(others.indexOf('Prior stage context only')).toBeLessThan(
      others.indexOf('Later stage context only'),
    );
    expect(others).toMatch(/\*\*Current stage\*\*\s+```json\ntrue/);
    expect(role.indexOf('Selected coding instructions only')).toBeLessThan(
      role.indexOf('Prior stage context only'),
    );
    for (const note of context.roleNotes) {
      expect(role.split(note.body)).toHaveLength(2);
      expect(role).toContain(note.id);
      expect(role).toContain(note.createdAt);
      expect(role).toContain(note.updatedAt);
    }
    expect(section(role, 'Other role notes')).toContain(
      'Removed interview step',
    );
    expect(section(role, 'Other role notes')).toContain(removedId);
    expect(section(role, 'Other role notes')).toContain(
      '  Legacy note only\nKeep spacing.  ',
    );
    expect(section(role, 'Application context')).toContain(
      'pending-update-operation',
    );
    expect(section(role, 'Application context')).toContain(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('preserves original update text, full structured receipts and every status in chronological order', () => {
    const context = richContext();
    const history = section(documentTexts(context).role, 'Update role history');
    const order = [
      'Oldest original update only',
      'Original update email:',
      'Pending original update only',
      'Failed original update only',
    ];
    for (let i = 1; i < order.length; i++)
      expect(history.indexOf(order[i - 1])).toBeLessThan(
        history.indexOf(order[i]),
      );
    for (const entry of context.updates) {
      for (const expected of [
        entry.text,
        entry.id,
        entry.createdAt,
        entry.status,
        ...entry.skipped,
      ])
        expect(history).toContain(expected);
      expect(history).toContain(JSON.stringify(entry.changes, null, 2));
    }
    expect(history).toContain('interview-process');
    expect(history).toContain('Saved update error only');
    expect(history).toContain(completedAt);
    expect(history).toContain('not current facts');
    const structured = [
      ...history.matchAll(/^(`{3,})json\n([\s\S]*?)^\1$/gm),
    ].map((match) => JSON.parse(match[2]));
    expect(structured).toContainEqual(context.updates[2].changes);
    expect(history).not.toContain('[object Object]');
  });

  it.each([
    'queued',
    'processing',
    'applied',
    'partial',
    'unchanged',
    'failed',
  ] as const)(
    'retains %s Update role entries rather than filtering history to successes',
    (status) => {
      const context = richContext();
      context.updates = [{ ...context.updates[0], status }];
      const history = section(
        documentTexts(context).role,
        'Update role history',
      );
      expect(history).toContain(context.updates[0].text);
      expect(history).toContain(`**Status**\n\n\`\`\`\n${status}\n\`\`\``);
    },
  );

  it('keeps generated analysis metadata, every evidence attribution and retained findings even when failed', () => {
    const context = richContext();
    const { company } = documentTexts(context);
    const analysis = section(company, 'Existing AI-generated company analysis');
    for (const expected of [
      'failed',
      'true',
      selectedId,
      startedAt,
      '2026-10-17T00:00:00.000Z',
      'Saved analysis error only',
      'technology',
      'preferred',
      'Generated explanation only',
      'Other saved role title',
    ])
      expect(analysis).toContain(expected);
    for (const label of [
      'Posting evidence',
      'Personal context evidence',
      'Historical Update role evidence',
      'Saved correction evidence',
      'Company comment evidence',
    ])
      expect(analysis).toContain(label);
    for (const evidence of context.company?.analysis.items[0].evidence ?? []) {
      expect(analysis).toContain(evidence.source);
      expect(analysis).toContain(evidence.excerpt);
      if (evidence.source === 'company-comment') {
        expect(analysis).toContain(evidence.noteId);
        expect(analysis).toContain(evidence.companyId);
      } else {
        expect(analysis).toContain(evidence.roleId);
        expect(analysis).toContain(evidence.roleTitle);
      }
    }
    expect(analysis).toMatch(/\*\*Total roles\*\*\s+```json\n8/);
    expect(analysis).toMatch(/\*\*Analyzed roles\*\*\s+```json\n7/);
    expect(analysis).toMatch(/\*\*Progress\*\*\s+```json\n6/);
  });

  it('preserves distinct comments with identical bodies and source text repeated legitimately in history', () => {
    const context = richContext();
    context.roleNotes = [
      note(currentId, 'Same saved comment', selectedId),
      note(laterId, 'Same saved comment', selectedId),
    ];
    context.updates[0].text = retainedText;
    const { listing, role } = documentTexts(context);
    expect(role.split('Same saved comment')).toHaveLength(3);
    expect(role).toContain(currentId);
    expect(role).toContain(laterId);
    expect(listing).toContain(retainedText);
    expect(role).toContain(retainedText);
  });

  it('exports three honest documents for missing listing, company, source and legacy technology data', () => {
    const context = richContext();
    context.posting.parsedPosting = null;
    delete context.posting.edits;
    delete context.posting.companyAssociation;
    delete context.posting.stageEnteredAt;
    context.posting.application.notes = '';
    context.company = null;
    context.source.source = null;
    context.roleNotes = [];
    context.updates = [];
    const { materials, listing, company, role } = documentTexts(context);
    expect(materials.documents).toHaveLength(3);
    expect(listing).toContain('No retained page text saved.');
    expect(listing).toMatch(/\*\*Technologies\*\*\s+Unknown/);
    expect(company).toContain('No saved company association.');
    expect(role).toContain('No saved notes.');
    expect(role).toContain('No saved Update role history.');
    expect(role).not.toContain('Legacy saved role notes');
    expect(materials.archiveFilename).toBe(
      'company-role-coding-exercise-prep-2026-10-19.zip',
    );
    expect(
      materials.documents.map((document) => document.downloadFilename),
    ).toEqual([
      'company-role-job-listing.md',
      'company-role-company-context.md',
      'company-role-role-context.md',
    ]);
    const legacy = richContext();
    if (!legacy.posting.parsedPosting)
      throw new Error('Fixture needs extracted posting');
    delete legacy.posting.parsedPosting.job.technologies;
    expect(
      section(documentTexts(legacy).listing, 'Current job listing'),
    ).toMatch(/\*\*Technologies\*\*\s+Unknown/);
  });

  it.each([
    'disabled',
    'not-started',
    'scheduled',
    'processing',
    'failed',
  ] as const)(
    'labels %s analysis without inventing an empty-result conclusion',
    (status) => {
      const context = richContext();
      if (!context.company) throw new Error('Fixture needs company');
      context.company.notes = [];
      context.company.analysis.status = status;
      context.company.analysis.items = [];
      const { company } = documentTexts(context);
      expect(company).toContain(status);
      expect(company).toContain('No saved notes.');
      expect(company).toContain('No saved findings in this analysis state.');
      expect(company).toContain(
        'does not establish that no commonalities exist',
      );
    },
  );

  it('uses safe bounded ASCII filename segments and the completion UTC date for the archive', () => {
    const context = richContext();
    if (
      !context.company ||
      !context.posting.edits ||
      !context.posting.application.interviewProcess
    )
      throw new Error('Fixture needs rich context');
    context.company.details.name = `../../${'A'.repeat(90)}\u0000`;
    context.posting.edits.overrides.title = '雪 / \\ ? #';
    context.posting.application.interviewProcess.stages[1].name = '😶';
    const { archiveFilename, documents } = formatPrepMaterials(context);
    expect(archiveFilename).toBe(
      `${'a'.repeat(59)}-role-stage-prep-2026-10-19.zip`,
    );
    expect(archiveFilename).toMatch(/^[a-z0-9-]+\.zip$/);
    expect(documents.map((document) => document.downloadFilename)).toEqual([
      `${'a'.repeat(59)}-role-job-listing.md`,
      `${'a'.repeat(59)}-role-company-context.md`,
      `${'a'.repeat(59)}-role-role-context.md`,
    ]);
  });

  it('does not manufacture an alternate prep target or a source mismatch', () => {
    const context = richContext();
    if (!context.source.source) throw new Error('Fixture needs retained text');
    context.source.source.sourceUrl = context.posting.sourceUrl;
    expect(documentTexts(context).listing).not.toContain('Source URL mismatch');
    context.stageId = removedId;
    expect(() => formatPrepMaterials(context)).toThrow();
  });
});
