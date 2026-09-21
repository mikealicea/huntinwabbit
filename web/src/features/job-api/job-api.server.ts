import 'server-only';
import { authConfig, backendSession } from '@/features/auth/auth.server.index';
import { createApiBridge } from './job-api.bridge';
import { apiConfig } from './job-api.config';
export async function postingRequest(request: Request) {
  try {
    return await createApiBridge({
      origin: apiConfig().origin,
      appOrigin: authConfig().origin,
      session: backendSession,
      fetch,
    })(request);
  } catch {
    return Response.json(
      {
        code: 'API_CONFIGURATION',
        message: 'The job service is not configured.',
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
