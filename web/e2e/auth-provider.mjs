// Test-only HTTP boundary. Never imported by application code or deployed.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const initialPostings = JSON.parse(
  readFileSync(new URL('./postings.fixture.json', import.meta.url), 'utf8'),
);
const postings = new Map();
const companies = new Map();
const updateHistories = new Map();
const roleNotes = new Map();
let postingSequence = 100;

const accounts = new Map();
const sessions = new Map();
const messages = new Map();
let sequence = 0;
const password = 'fictional-password';
function account(email, overrides = {}) {
  const value = {
    id: `user-${++sequence}`,
    email,
    password,
    confirmed: true,
    ...overrides,
  };
  const existing = accounts.get(email);
  const saved = existing ? Object.assign(existing, overrides) : value;
  accounts.set(email, saved);
  return saved;
}
account('workspace@example.test');
function user(value) {
  return {
    id: value.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: value.email,
    email_confirmed_at: value.confirmed ? '2026-09-18T00:00:00Z' : null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-09-18T00:00:00Z',
  };
}
function session(value, recovery = false) {
  const key = `fictional-session-${++sequence}`;
  const refresh = `fictional-refresh-${sequence}`;
  sessions.set(key, { account: value, recovery, refresh });
  return {
    access_token: key,
    refresh_token: refresh,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: user(value),
  };
}
function message(value, type, redirect) {
  const token = `pkce_${createHash('sha224').update(`fictional-${++sequence}`).digest('hex')}`;
  const link = `${redirect}?token_hash=${token}&type=${type}`;
  messages.set(token, { account: value, type, link });
  return link;
}
const server = createServer(async (request, response) => {
  function send(status, body) {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  }
  function error(status, code) {
    send(status, { code, msg: code, error_code: code });
  }
  const url = new URL(request.url, 'http://127.0.0.1:3101');
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString())
    : {};
  const token = request.headers.authorization?.replace('Bearer ', '');
  const active = sessions.get(token);
  if (url.pathname === '/health') return send(200, { ready: true });
  if (
    url.pathname.startsWith('/job-postings') ||
    url.pathname.startsWith('/companies')
  ) {
    if (!active) return error(401, 'unauthorized');
    const owner = active.account.id;
    if (!postings.has(owner))
      postings.set(
        owner,
        new Map(
          structuredClone(initialPostings).map((item) => [item.id, item]),
        ),
      );
    const records = postings.get(owner);
    if (!companies.has(owner)) {
      const saved = new Map();
      for (const item of records.values()) {
        const name = item.parsedPosting?.job.company.name;
        if (!name) continue;
        let company = [...saved.values()].find(
          (company) => company.name === name,
        );
        if (!company) {
          company = {
            id: randomUUID(),
            name,
            website: item.parsedPosting.job.company.website,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
          saved.set(company.id, company);
        }
        item.companyAssociation = {
          company: {
            id: company.id,
            name: company.name,
            website: company.website,
          },
          mode: 'automatic',
          revision: 0,
        };
      }
      companies.set(owner, saved);
    }
    const companyRecords = companies.get(owner);
    if (url.pathname.startsWith('/companies')) {
      const [, , companyId, child] = url.pathname.split('/');
      if (request.method !== 'GET') return error(405, 'method_not_allowed');
      if (!companyId)
        return send(200, {
          schemaVersion: 1,
          items: [...companyRecords.values()].filter((c) =>
            c.name
              .toLowerCase()
              .includes((url.searchParams.get('q') ?? '').toLowerCase()),
          ),
          nextCursor: null,
        });
      const company = companyRecords.get(companyId);
      if (!company) return error(404, 'not_found');
      if (child === 'roles')
        return send(200, {
          schemaVersion: 1,
          items: [...records.values()]
            .filter(
              (item) => item.companyAssociation?.company?.id === companyId,
            )
            .sort(
              (a, b) =>
                b.createdAt.localeCompare(a.createdAt) ||
                b.id.localeCompare(a.id),
            ),
          nextCursor: null,
        });
      return send(200, { schemaVersion: 1, item: company });
    }
    const [, , id, operation] = url.pathname.split('/');
    if (operation === 'company' && request.method === 'PATCH') {
      const item = records.get(id);
      if (!item) return error(404, 'not_found');
      if (item.recordVersion !== body.expectedRecordVersion)
        return error(409, 'conflict');
      let company = null;
      if (body.selection?.id) {
        company = companyRecords.get(body.selection.id);
        if (!company) return error(404, 'not_found');
      }
      if (body.selection?.create) {
        company = [...companyRecords.values()].find(
          (c) =>
            c.name.toLowerCase() === body.selection.create.name.toLowerCase(),
        );
        if (!company) {
          company = {
            id: randomUUID(),
            ...body.selection.create,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          companyRecords.set(company.id, company);
        }
      }
      item.companyAssociation = {
        company: company
          ? { id: company.id, name: company.name, website: company.website }
          : null,
        mode: 'manual',
        revision: (item.companyAssociation?.revision ?? 0) + 1,
      };
      item.recordVersion++;
      item.applicationVersion++;
      return send(200, { schemaVersion: 1, item });
    }
    if (operation === 'notes') {
      const role = records.get(id);
      if (!role) return error(404, 'not_found');
      const key = `${owner}:${id}`;
      const list = roleNotes.get(key) ?? [];
      roleNotes.set(key, list);
      if (request.method === 'GET') {
        const after = Number(url.searchParams.get('cursor') ?? 0);
        return send(200, {
          schemaVersion: 1,
          items: list.slice(after, after + 20),
          nextCursor: list.length > after + 20 ? String(after + 20) : null,
        });
      }
      const noteId = url.pathname.split('/')[4] ?? body.id;
      const note = list.find((item) => item.id === noteId);
      if (request.method === 'POST') {
        if (note)
          return note.body === body.body
            ? send(200, { schemaVersion: 1, note })
            : error(409, 'conflict');
        const timestamp = new Date().toISOString();
        const created = {
          id: noteId,
          body: body.body,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
        };
        list.unshift(created);
        role.applicationVersion++;
        role.recordVersion++;
        return send(201, { schemaVersion: 1, note: created });
      }
      if (!note) return error(404, 'not_found');
      if (note.revision !== body.expectedRevision)
        return error(409, 'conflict');
      role.applicationVersion++;
      role.recordVersion++;
      if (request.method === 'DELETE') {
        roleNotes.set(
          key,
          list.filter((item) => item.id !== noteId),
        );
        response.writeHead(204);
        response.end();
        return;
      }
      Object.assign(note, {
        body: body.body,
        revision: note.revision + 1,
        updatedAt: new Date().toISOString(),
      });
      return send(200, { schemaVersion: 1, note });
    }
    if (operation === 'updates') {
      const role = records.get(id);
      if (!role) return error(404, 'not_found');
      const key = `${owner}:${id}`;
      const history = updateHistories.get(key) ?? [];
      updateHistories.set(key, history);
      if (request.method === 'GET')
        return send(200, {
          schemaVersion: 1,
          items: history.slice(-5).reverse(),
          nextCursor: null,
        });
      const operationId = url.pathname.split('/')[4];
      if (operationId) {
        const entry = history.find((entry) => entry.id === operationId);
        if (!entry) return error(404, 'not_found');
        if (!entry.undoneAt) {
          for (const change of entry.changes) {
            if (change.field === 'title')
              role.edits.overrides.title = change.before;
            else role.application[change.field] = change.before;
          }
          role.recordVersion++;
          role.applicationVersion++;
          entry.undoneAt = new Date().toISOString();
        }
        return send(200, { schemaVersion: 1, entry });
      }
      const prior = history.find((entry) => entry.id === body.operationId);
      if (prior) return send(202, { schemaVersion: 1, entry: prior });
      if (role.edits?.pending) return error(409, 'conflict');
      const entry = {
        id: body.operationId,
        text: body.text,
        createdAt: new Date().toISOString(),
        status: 'queued',
        changes: [],
        skipped: [],
        error: null,
        undoneAt: null,
        ...(body.retryOf ? { retryOf: body.retryOf } : {}),
      };
      history.push(entry);
      role.edits = {
        overrides: role.edits?.overrides ?? {},
        revisions: {},
        pending: entry.id,
      };
      setTimeout(() => {
        const current = records.get(id);
        if (!current) return;
        if (entry.text.includes('simulate failure') && !entry.retryOf) {
          entry.status = 'failed';
          entry.error = 'The update could not finish.';
        } else {
          entry.changes = [
            {
              field: 'title',
              before:
                current.edits.overrides.title ??
                current.parsedPosting.job.title,
              after: 'Staff Product Engineer',
            },
            {
              field: 'priority',
              before: current.application.priority,
              after: 'high',
            },
          ];
          current.edits.overrides.title = 'Staff Product Engineer';
          current.application.priority = 'high';
          entry.skipped = entry.text.includes('unclear')
            ? ['The salary is unclear.']
            : [];
          entry.status = entry.skipped.length ? 'partial' : 'applied';
        }
        current.edits.pending = null;
        current.recordVersion++;
        current.applicationVersion++;
      }, 800);
      return send(202, { schemaVersion: 1, entry });
    }

    if (request.method === 'GET')
      return id
        ? records.has(id)
          ? send(200, { schemaVersion: 1, item: records.get(id) })
          : error(404, 'not_found')
        : send(200, {
            schemaVersion: 1,
            items: [...records.values()],
            nextCursor: null,
          });
    if (request.method === 'POST' && !id) {
      const sourceUrl = new URL(
        body.url.startsWith('http') ? body.url : `https://${body.url}`,
      ).href;
      const prior = [...records.values()].find(
        (item) => item.sourceUrl === sourceUrl,
      );
      if (prior)
        return send(200, { schemaVersion: 1, item: prior, created: false });
      const item = {
        id: `00000000-0000-4000-8000-${String(postingSequence++).padStart(12, '0')}`,
        sourceUrl,
        parsedPosting: null,
        application: {
          stage: 'collected',
          interest: body.application.interest,
          priority: 'not-set',
          followUpOn: null,
          notes: '',
        },
        applicationVersion: 0,
        recordVersion: 0,
        createdAt: '2026-09-21T00:00:00.000Z',
        updatedAt: '2026-09-21T00:00:00.000Z',
        extraction: { status: 'disabled', generation: null, error: null },
      };
      records.set(item.id, item);
      return send(201, { schemaVersion: 1, item, created: true });
    }
    const item = records.get(id);
    if (request.method === 'DELETE') {
      if (item && item.applicationVersion !== body.expectedApplicationVersion)
        return error(409, 'conflict');
      records.delete(id);
      updateHistories.delete(`${owner}:${id}`);
      response.writeHead(204);
      return response.end();
    }
    if (!item) return error(404, 'not_found');
    if (request.method === 'PATCH') {
      if (item.applicationVersion !== body.expectedApplicationVersion)
        return error(409, 'conflict');
      const next = {
        ...item,
        application: { ...item.application, ...body.changes },
        applicationVersion: item.applicationVersion + 1,
        recordVersion: item.recordVersion + 1,
      };
      records.set(id, next);
      return send(200, { schemaVersion: 1, item: next });
    }
    if (request.method === 'POST' && operation === 'extraction') {
      if (['queued', 'processing'].includes(item.extraction.status))
        return send(202, { schemaVersion: 1, item });
      if (body.expectedGeneration !== item.extraction.generation)
        return error(409, 'conflict');
      const shouldFail = item.extraction.status !== 'failed';
      const generation = randomUUID();
      const next = {
        ...item,
        recordVersion: item.recordVersion + 1,
        extraction: { status: 'queued', generation, error: null },
      };
      records.set(id, next);
      setTimeout(() => {
        const current = records.get(id);
        if (!current || current.extraction.generation !== generation) return;
        records.set(id, {
          ...current,
          recordVersion: current.recordVersion + 1,
          parsedPosting: shouldFail
            ? current.parsedPosting
            : {
                ...(current.parsedPosting ?? initialPostings[0].parsedPosting),
                source: {
                  ...initialPostings[0].parsedPosting.source,
                  normalizedUrl: current.sourceUrl,
                },
                job: {
                  ...(current.parsedPosting ?? initialPostings[0].parsedPosting)
                    .job,
                  title: 'Refreshed Product Engineer',
                },
              },
          extraction: {
            status: shouldFail ? 'failed' : 'complete',
            generation,
            error: shouldFail ? 'SOURCE_BLOCKED' : null,
          },
        });
      }, 200);
      return send(202, { schemaVersion: 1, item: next });
    }
    return error(405, 'method_not_allowed');
  }

  if (url.pathname === '/__test/account')
    return send(200, user(account(body.email, body)));
  if (url.pathname === '/__test/message') {
    const sent = [...messages.values()]
      .filter(
        (entry) =>
          entry.account.email === body.email && entry.type === body.type,
      )
      .at(-1);
    return send(200, { link: sent?.link });
  }
  if (url.pathname === '/__test/session')
    return send(200, session(accounts.get(body.email)));
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const previous = [...sessions.values()].find(
        (entry) => entry.refresh === body.refresh_token,
      );
      if (!previous) return error(400, 'refresh_token_not_found');
      return send(200, session(previous.account, previous.recovery));
    }
    const value = accounts.get(body.email);
    if (body.email === 'rate-limit@example.test')
      return error(429, 'over_request_rate_limit');
    if (!value || value.password !== body.password)
      return error(400, 'invalid_credentials');
    if (!value.confirmed) return error(400, 'email_not_confirmed');
    return send(200, session(value));
  }
  if (url.pathname === '/auth/v1/signup') {
    if (accounts.has(body.email))
      return send(200, { id: 'obfuscated', identities: [] });
    const value = account(body.email, {
      password: body.password,
      confirmed: false,
    });
    message(value, 'email', url.searchParams.get('redirect_to'));
    return send(200, user(value));
  }
  if (
    url.pathname === '/auth/v1/resend' ||
    url.pathname === '/auth/v1/recover'
  ) {
    const value = accounts.get(body.email);
    if (value)
      message(
        value,
        url.pathname.endsWith('resend') ? 'email' : 'recovery',
        url.searchParams.get('redirect_to'),
      );
    return send(200, {});
  }
  if (url.pathname === '/auth/v1/verify') {
    const sent = messages.get(body.token_hash);
    if (!sent || sent.type !== body.type) return error(403, 'otp_expired');
    messages.delete(body.token_hash);
    sent.account.confirmed = true;
    return send(200, session(sent.account, body.type === 'recovery'));
  }
  if (url.pathname === '/auth/v1/user') {
    if (!active) return error(401, 'session_not_found');
    if (active.account.lookupFailure) return error(503, 'unexpected_failure');
    if (request.method === 'PUT') {
      if (active.account.password === body.password)
        return error(422, 'same_password');
      active.account.password = body.password;
    }
    return send(200, user(active.account));
  }
  if (url.pathname === '/auth/v1/logout') {
    if (active?.account.logoutFailure) return error(503, 'unexpected_failure');
    sessions.delete(token);
    return send(200, {});
  }
  return error(404, 'unknown_test_endpoint');
});
server.listen(3101, '127.0.0.1');
process.on('SIGTERM', () => server.close());
