import type {
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { ZodType, z } from 'zod';
import {
  analysisResponseSchema,
  type CompanyAnalysis,
} from './job-api.analysis.contracts';
import {
  type Company,
  companyResponseSchema,
} from './job-api.companies.contracts';
import {
  itemResponseSchema,
  notesPageSchema,
  type RoleNote,
  type SavedPosting,
  sourceTextResponseSchema,
  type UpdateEntry,
  updateHistorySchema,
} from './job-api.contracts';

export type PrepContextArgs = { roleId: string; stageId: string };
export type PrepContext = {
  posting: SavedPosting;
  stageId: string;
  source: z.infer<typeof sourceTextResponseSchema>;
  roleNotes: RoleNote[];
  updates: UpdateEntry[];
  company: null | {
    details: Company;
    notes: RoleNote[];
    analysis: Omit<CompanyAnalysis, 'nextCursor'>;
  };
  startedAt: string;
  completedAt: string;
};
export type PrepRead = (
  args: string | FetchArgs,
) => Promise<{ data: unknown } | { error: FetchBaseQueryError }>;

type Source =
  | 'saved role'
  | 'retained page text'
  | 'role comments'
  | 'Update role history'
  | 'associated company'
  | 'company comments'
  | 'company analysis';
const changedMessage = 'Saved context changed while exporting. Try again.';

class PrepFailure extends Error {
  constructor(readonly error: FetchBaseQueryError) {
    super('Prep acquisition failed.');
  }
}

function failure(source: Source, error?: FetchBaseQueryError): PrepFailure {
  const message =
    error?.status === 401
      ? 'Your session expired. Sign in again to export prep materials.'
      : error?.status === 409
        ? changedMessage
        : `Could not load ${source}. No export was created. Try again.`;
  return new PrepFailure(
    typeof error?.status === 'number'
      ? { status: error.status, data: { message } }
      : { status: 'CUSTOM_ERROR', error: message },
  );
}

export async function loadPrepContext(
  args: PrepContextArgs,
  read: PrepRead,
  signal: AbortSignal,
): Promise<{ data: PrepContext } | { error: FetchBaseQueryError }> {
  const startedAt = new Date().toISOString();

  async function readSource<T>(
    request: string | FetchArgs,
    schema: ZodType<T>,
    source: Source,
  ): Promise<T> {
    if (signal.aborted) throw failure(source);
    try {
      const result = await read(request);
      if (signal.aborted) throw failure(source);
      if ('error' in result) throw failure(source, result.error);
      const parsed = schema.safeParse(result.data);
      if (!parsed.success) throw failure(source);
      return parsed.data;
    } catch (error) {
      throw error instanceof PrepFailure ? error : failure(source);
    }
  }

  async function readPages<
    Page extends { items: unknown[]; nextCursor: string | null },
  >(
    url: string,
    schema: ZodType<Page>,
    source: Source,
    checkPage?: (first: Page, next: Page) => void,
  ): Promise<Omit<Page, 'nextCursor'>> {
    const first = await readSource(url, schema, source);
    const { nextCursor: initialCursor, ...collected } = first;
    let cursor = initialCursor;
    const seen = new Set<string>();
    while (cursor !== null) {
      if (seen.has(cursor)) throw failure(source);
      seen.add(cursor);
      const page = await readSource(
        { url, params: { cursor } },
        schema,
        source,
      );
      checkPage?.(first, page);
      collected.items.push(...page.items);
      cursor = page.nextCursor;
    }
    return collected;
  }

  async function readCompany(id: string): Promise<PrepContext['company']> {
    const [details, notes, analysis] = await Promise.all([
      readSource(
        `/companies/${id}`,
        companyResponseSchema,
        'associated company',
      ),
      readPages(`/companies/${id}/notes`, notesPageSchema, 'company comments'),
      readPages(
        `/companies/${id}/analysis`,
        analysisResponseSchema,
        'company analysis',
        (first, next) => {
          // Public processing generation is not the cursor's published generation.
          if (first.completedAt !== next.completedAt)
            throw new PrepFailure({
              status: 'CUSTOM_ERROR',
              error: changedMessage,
            });
        },
      ),
    ]);
    return { details: details.item, notes: notes.items, analysis };
  }

  try {
    const { roleId, stageId } = args;
    const { item: posting } = await readSource(
      `/${roleId}`,
      itemResponseSchema,
      'saved role',
    );
    if (
      !posting.application.interviewProcess?.stages.some(
        (stage) => stage.id === stageId,
      )
    )
      throw new PrepFailure({
        status: 'CUSTOM_ERROR',
        error:
          'This interview step is no longer available. Close and reopen the interview details.',
      });
    const companyId = posting.companyAssociation?.company?.id;
    const [source, roleNotes, updates, company] = await Promise.all([
      readSource(
        `/${roleId}/source-text`,
        sourceTextResponseSchema,
        'retained page text',
      ),
      readPages(`/${roleId}/notes`, notesPageSchema, 'role comments'),
      readPages(
        `/${roleId}/updates`,
        updateHistorySchema,
        'Update role history',
      ),
      companyId ? readCompany(companyId) : Promise.resolve(null),
    ]);
    const { item: currentPosting } = await readSource(
      `/${roleId}`,
      itemResponseSchema,
      'saved role',
    );
    if (currentPosting.recordVersion !== posting.recordVersion)
      throw new PrepFailure({
        status: 'CUSTOM_ERROR',
        error: changedMessage,
      });
    return {
      data: {
        posting,
        stageId,
        source,
        roleNotes: roleNotes.items,
        updates: updates.items,
        company,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof PrepFailure
          ? error.error
          : failure('saved role').error,
    };
  }
}
