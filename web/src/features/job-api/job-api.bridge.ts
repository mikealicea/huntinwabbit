import 'server-only';
import { z } from 'zod';
import {
  companiesResponseSchema,
  companyQuerySchema,
  companyResponseSchema,
  companySelectionSchema,
} from './job-api.companies.contracts';
import {
  deleteRequestSchema,
  extractionRequestSchema,
  historyQuerySchema,
  itemResponseSchema,
  listRequestSchema,
  listResponseSchema,
  saveRequestSchema,
  saveResponseSchema,
  updateHistorySchema,
  updateMessageSchema,
  updateRequestSchema,
  updateResultSchema,
} from './job-api.contracts';

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
};
function failure(status: number, code: string) {
  return Response.json(
    {
      code,
      message:
        status === 401
          ? 'Your session expired. Sign in again.'
          : status === 409
            ? 'This role changed. Refresh and review your changes.'
            : status === 404
              ? 'This saved role was not found.'
              : 'The request could not be completed. Please try again.',
    },
    { status, headers },
  );
}
async function boundedJson(request: Request | Response, max: number) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error('Body too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel();
  }
}
export function createApiBridge(deps: {
  origin: string;
  appOrigin: string;
  session: () => Promise<
    | { status: 'authenticated'; accessToken: string }
    | { status: 'anonymous' | 'unavailable' }
  >;
  fetch: typeof fetch;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (
        request.method !== 'GET' &&
        request.headers.get('origin') !== deps.appOrigin
      )
        return failure(403, 'INVALID_ORIGIN');
      const session = await deps.session();
      if (session.status !== 'authenticated')
        return failure(
          session.status === 'anonymous' ? 401 : 503,
          'AUTH_UNAVAILABLE',
        );
      const url = new URL(request.url);
      const suffix = url.pathname.slice('/api/job-postings'.length);
      const companyMatch = /^\/companies(?:\/([0-9a-f-]{36})(\/roles)?)?$/.exec(
        suffix,
      );
      if (companyMatch?.[1] && !z.uuid().safeParse(companyMatch[1]).success)
        return failure(404, 'NOT_FOUND');
      const match =
        /^\/([0-9a-f-]{36})(\/company|\/extraction|\/updates(?:\/([0-9a-f-]{36})\/undo)?)?$/.exec(
          suffix,
        );
      if (
        suffix &&
        !companyMatch &&
        (!match || !z.uuid().safeParse(match[1]).success)
      )
        return failure(404, 'NOT_FOUND');
      if (match?.[3] && !z.uuid().safeParse(match[3]).success)
        return failure(404, 'NOT_FOUND');
      const action = companyMatch
        ? request.method === 'GET'
          ? companyMatch[2]
            ? 'companyRoles'
            : companyMatch[1]
              ? 'company'
              : 'companies'
          : undefined
        : request.method === 'PATCH' && match?.[2] === '/company'
          ? 'selectCompany'
          : request.method === 'GET' && match?.[2] === '/updates'
            ? 'history'
            : request.method === 'POST' && match?.[3]
              ? 'undo'
              : request.method === 'POST' && match?.[2] === '/updates'
                ? 'message'
                : request.method === 'GET' && !match
                  ? 'list'
                  : request.method === 'GET' && match && !match[2]
                    ? 'get'
                    : request.method === 'POST' && !match
                      ? 'save'
                      : request.method === 'PATCH' && match && !match[2]
                        ? 'update'
                        : request.method === 'POST' &&
                            match?.[2] === '/extraction'
                          ? 'extract'
                          : request.method === 'DELETE' && match && !match[2]
                            ? 'delete'
                            : undefined;
      if (!action) return failure(405, 'METHOD_NOT_ALLOWED');
      let query = '';
      let body: string | undefined;
      try {
        if (['list', 'history', 'companies', 'companyRoles'].includes(action)) {
          if (
            [...url.searchParams.keys()].some(
              (key) => url.searchParams.getAll(key).length !== 1,
            )
          )
            return failure(400, 'INVALID_REQUEST');
          (action === 'companies'
            ? companyQuerySchema
            : action === 'history'
              ? historyQuerySchema
              : listRequestSchema
          ).parse(Object.fromEntries(url.searchParams));
          query = url.search;
        } else if (url.search) return failure(400, 'INVALID_REQUEST');
        if (
          [
            'save',
            'update',
            'extract',
            'delete',
            'message',
            'undo',
            'selectCompany',
          ].includes(action)
        ) {
          if (
            !request.headers.get('content-type')?.startsWith('application/json')
          )
            return failure(415, 'UNSUPPORTED_MEDIA_TYPE');
          const value = await boundedJson(request, 256 * 1024);
          const schema =
            action === 'selectCompany'
              ? companySelectionSchema
              : action === 'message'
                ? updateMessageSchema
                : action === 'undo'
                  ? z.strictObject({})
                  : action === 'save'
                    ? saveRequestSchema
                    : action === 'update'
                      ? updateRequestSchema
                      : action === 'delete'
                        ? deleteRequestSchema
                        : extractionRequestSchema;
          body = JSON.stringify(schema.parse(value));
        }
      } catch {
        return failure(400, 'INVALID_REQUEST');
      }
      const response = await deps.fetch(
        `${deps.origin}${companyMatch ? suffix : `/job-postings${suffix}`}${query}`,
        {
          method: request.method,
          body,
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
        },
      );
      if (!response.ok) {
        const status = [400, 401, 403, 404, 409, 413, 415, 429, 503].includes(
          response.status,
        )
          ? response.status
          : 502;
        return failure(status, status === 409 ? 'CONFLICT' : 'API_UNAVAILABLE');
      }
      if (action === 'delete')
        return response.status === 204
          ? new Response(null, { status: 204, headers })
          : failure(502, 'INVALID_RESPONSE');
      const schema =
        action === 'company'
          ? companyResponseSchema
          : action === 'companies'
            ? companiesResponseSchema
            : action === 'companyRoles'
              ? listResponseSchema
              : action === 'history'
                ? updateHistorySchema
                : ['message', 'undo'].includes(action)
                  ? updateResultSchema
                  : action === 'list'
                    ? listResponseSchema
                    : action === 'save'
                      ? saveResponseSchema
                      : itemResponseSchema;
      const result = schema.parse(await boundedJson(response, 2 * 1024 * 1024));
      return Response.json(result, { status: response.status, headers });
    } catch {
      return failure(503, 'API_UNAVAILABLE');
    }
  };
}
