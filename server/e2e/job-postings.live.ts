import { randomUUID } from 'node:crypto';
import { savedPostingSchema } from '../src/features/job-postings/job-postings.schemas.ts';
import {
  liveConfiguration,
  liveRequest,
  responseObject,
} from './live-client.ts';

// Explicit live mutation suite. This suite never requests paid parsing.
const config = liveConfiguration();
const url = process.env.LIVE_JOB_URL;
if (!url)
  throw new Error(
    'LIVE_JOB_URL is required for the dedicated dev smoke record.',
  );
let accessToken = '';
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}
async function call(path: string, method = 'GET', body?: unknown) {
  return liveRequest(`${config.api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  const login = await liveRequest(
    `${config.issuer}/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: config.email, password: config.password }),
    },
  );
  check(login.status === 200, 'Dedicated account sign-in failed');
  const session = await responseObject(login);
  check(typeof session.access_token === 'string', 'Missing session');
  accessToken = session.access_token;
  const response = await call('/job-postings', 'POST', {
    url,
    extract: false,
    application: { interest: 'interested' },
  });
  check([200, 201].includes(response.status), 'Save failed');
  const body = await responseObject(response);
  const parsed = savedPostingSchema.safeParse(body.item);
  check(parsed.success, 'Save contract failed');
  const item = parsed.data;
  const duplicate = await responseObject(
    await call('/job-postings', 'POST', { url }),
  );
  check(duplicate.created === false, 'Duplicate created another record');
  const duplicateItem = savedPostingSchema.safeParse(duplicate.item);
  check(
    duplicateItem.success && duplicateItem.data.id === item.id,
    'Duplicate identity changed',
  );
  const update = await call(`/job-postings/${item.id}`, 'PATCH', {
    expectedApplicationVersion: item.applicationVersion,
    changes: {
      notes: 'Dedicated development integration smoke record.',
      priority: 'low',
    },
  });
  check(update.status === 200, 'Tracking update failed');
  check(
    (
      await call(`/job-postings/${item.id}`, 'PATCH', {
        expectedApplicationVersion: item.applicationVersion,
        changes: { stage: 'closed' },
      })
    ).status === 409,
    'Stale update accepted',
  );
  const detail = await responseObject(await call(`/job-postings/${item.id}`));
  const final = savedPostingSchema.safeParse(detail.item);
  check(
    final.success &&
      final.data.application.notes ===
        'Dedicated development integration smoke record.',
    'Reload did not preserve notes',
  );
  check(
    (await call(`/job-postings/${randomUUID()}`)).status === 404,
    'Missing record contract failed',
  );
  const list = await call('/job-postings?limit=1');
  check(
    list.status === 200 && list.headers.get('cache-control') === 'no-store',
    'Private list failed',
  );
  console.log(
    JSON.stringify({
      event: 'posting-live-smoke.passed',
      checks: [
        'save',
        'duplicate',
        'detail',
        'update',
        'conflict',
        'reload',
        'missing',
        'list',
      ],
      retainedDedicatedRecords: 1,
      paidCalls: 0,
    }),
  );
} catch {
  console.error(
    'Dedicated posting smoke failed; private response details suppressed.',
  );
  process.exitCode = 1;
} finally {
  if (accessToken) {
    const logout = await liveRequest(`${config.issuer}/logout?scope=local`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (logout.status !== 204) {
      console.error('Dedicated session teardown failed.');
      process.exitCode = 1;
    }
  }
}
