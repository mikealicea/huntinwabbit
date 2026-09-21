import { isHelloResponse } from './hello.types';

type Session =
  | { status: 'authenticated'; accessToken: string }
  | { status: 'anonymous' | 'unavailable' };

export function createHelloBridge(dependencies: {
  origin: string;
  session: () => Promise<Session>;
  fetch: typeof fetch;
}) {
  return async function helloRequest() {
    const headers = { 'Cache-Control': 'private, no-store' };
    function failure(status: number, message: string) {
      return Response.json({ message }, { status, headers });
    }
    try {
      const session = await dependencies.session();
      if (session.status === 'anonymous')
        return failure(401, 'Please log in again.');
      if (session.status !== 'authenticated')
        return failure(503, 'Authentication is temporarily unavailable.');
      const response = await dependencies.fetch(
        new URL('/', dependencies.origin),
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status === 401) return failure(401, 'Please log in again.');
      if (!response.ok)
        return failure(502, 'The API is temporarily unavailable.');
      const data: unknown = await response.json();
      if (!isHelloResponse(data))
        return failure(502, 'The API returned an unexpected response.');
      return Response.json({ message: data.message }, { headers });
    } catch {
      return failure(
        503,
        'Unable to complete the API request. Please try again.',
      );
    }
  };
}
