import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { savedPostingSchema } from '../src/features/job-postings/job-postings.schemas.ts';
import { updateHistorySchema } from '../src/features/job-postings/job-postings.updates.schemas.ts';
import {
  liveConfiguration,
  liveRequest,
  responseObject,
} from './live-client.ts';

// Explicit hosted smoke: four chat completions at most, no fetching or retries.
const config = liveConfiguration();
if (process.env.COMPANY_MATCHING_LIVE_TARGET !== config.api)
  throw new Error(
    'Set COMPANY_MATCHING_LIVE_TARGET to the reviewed E2E API origin.',
  );
const run = randomUUID();
const roles: string[] = [];
let token = '';
let submitted = 0;
class SmokeFailure extends Error {}
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new SmokeFailure(label);
}
async function call(path: string, method = 'GET', body?: unknown) {
  return liveRequest(`${config.api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function read(id: string) {
  const response = await call(`/job-postings/${id}`);
  check(response.status === 200, 'Role read failed');
  const result = savedPostingSchema.safeParse(
    (await responseObject(response)).item,
  );
  check(result.success, 'Role contract failed');
  return result.data;
}
async function save() {
  const response = await call('/job-postings', 'POST', {
    url: `https://jobs.example.test/company-smoke/${run}/${roles.length}`,
    extract: false,
  });
  check(response.status === 201, 'Role save failed');
  const result = savedPostingSchema.safeParse(
    (await responseObject(response)).item,
  );
  check(result.success, 'Role save contract failed');
  roles.push(result.data.id);
  return result.data;
}
async function seed(name: string) {
  const role = await save();
  const response = await call(`/job-postings/${role.id}/company`, 'PATCH', {
    expectedRecordVersion: role.recordVersion,
    selection: { create: { name, website: null } },
  });
  check(response.status === 200, 'Seed company failed');
  const company = (await read(role.id)).companyAssociation?.company;
  check(company, 'Seed company missing');
  return company.id;
}
async function update(text: string) {
  check(submitted < 4, 'Paid call budget exceeded');
  const role = await save();
  const operationId = randomUUID();
  const response = await call(`/job-postings/${role.id}/updates`, 'POST', {
    operationId,
    text,
    timezone: 'UTC',
  });
  submitted++;
  check(response.status === 202, 'Chat submission failed');
  for (let attempt = 0; attempt < 45; attempt++) {
    await setTimeout(2000);
    const history = await call(`/job-postings/${role.id}/updates`);
    check(history.status === 200, 'History read failed');
    const result = updateHistorySchema.safeParse(await responseObject(history));
    check(result.success, 'History contract failed');
    const entry = result.data.items.find((value) => value.id === operationId);
    if (!entry || ['queued', 'processing'].includes(entry.status)) continue;
    check(['applied', 'partial'].includes(entry.status), 'Chat did not apply');
    return { item: await read(role.id), operationId };
  }
  throw new SmokeFailure('Chat completion deadline exceeded');
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
  check(login.status === 200, 'Dedicated sign-in failed');
  const session = await responseObject(login);
  check(typeof session.access_token === 'string', 'Missing session');
  token = session.access_token;
  const short = `Lumen Smoke ${run}`;
  const full = `${short} with Example Partner`;
  const firstId = await seed(full);
  const first = await update(
    `Set companyName to "${short}" and title to "Engineer". Posting: About ${full}. ${short} is the short name of ${full}; they are one employer hiring this engineer.`,
  );
  check(
    first.item.companyAssociation?.company?.id === firstId,
    'Short name did not reuse company',
  );
  check(
    first.item.edits?.overrides.companyName === short,
    'Short source name was not preserved',
  );
  const undo = await call(
    `/job-postings/${first.item.id}/updates/${first.operationId}/undo`,
    'POST',
    {},
  );
  check(
    undo.status === 200 &&
      !(await read(first.item.id)).companyAssociation?.company,
    'Contextual Undo failed',
  );
  const reverseShort = `Prism Smoke ${run}`;
  const secondId = await seed(reverseShort);
  const second = await update(
    `Set companyName to "${reverseShort} with Example Partner". This posting identifies ${reverseShort} and ${reverseShort} with Example Partner as the same employer; one is its short name and the other its branding.`,
  );
  check(
    second.item.companyAssociation?.company?.id === secondId,
    'Long name did not reuse company',
  );
  check(
    second.item.edits?.overrides.companyName ===
      `${reverseShort} with Example Partner`,
    'Long source name was not preserved',
  );
  const unrelated = await update(
    `Set companyName to "${short} Laboratories". This is an independent employer unrelated to ${full}; similar names do not indicate shared identity.`,
  );
  check(
    unrelated.item.companyAssociation?.company?.name ===
      `${short} Laboratories` &&
      unrelated.item.companyAssociation.company.id !== firstId,
    'Similar names were incorrectly grouped',
  );
  const partner = await update(
    `Set companyName to "Orion Smoke ${run}". Orion is the employer. ${full} is only its client, not its parent or employer.`,
  );
  check(
    partner.item.companyAssociation?.company?.name === `Orion Smoke ${run}` &&
      partner.item.companyAssociation.company.id !== firstId,
    'Client mention was incorrectly grouped',
  );
  console.log(
    JSON.stringify({
      event: 'company-matching-live.passed',
      chatSubmissions: submitted,
      retainedCompanyFixtures: 4,
    }),
  );
} catch (cause) {
  console.error(
    JSON.stringify({
      event: 'company-matching-live.failed',
      chatSubmissions: submitted,
      reason:
        cause instanceof SmokeFailure
          ? cause.message
          : 'External request or response contract failed',
    }),
  );
  process.exitCode = 1;
} finally {
  for (const id of roles) {
    try {
      const item = await read(id);
      const response = await call(`/job-postings/${id}`, 'DELETE', {
        expectedApplicationVersion: item.applicationVersion,
      });
      check(response.status === 204, 'Smoke cleanup failed');
    } catch {
      console.error('Dedicated role cleanup failed.');
      process.exitCode = 1;
    }
  }
  if (token) {
    try {
      const response = await liveRequest(
        `${config.issuer}/logout?scope=local`,
        {
          method: 'POST',
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      check(response.status === 204, 'Session cleanup failed');
    } catch {
      console.error('Dedicated session teardown failed.');
      process.exitCode = 1;
    }
  }
}
