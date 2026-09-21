import 'server-only';
import { backendSession } from '@/features/auth/auth.server.index';
import { createHelloBridge } from './hello.bridge';
import { apiConfig } from './hello.config';

export async function helloRequest() {
  try {
    return await createHelloBridge({
      origin: apiConfig().origin,
      session: backendSession,
      fetch,
    })();
  } catch {
    return Response.json(
      { message: 'The API is not configured.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
}
