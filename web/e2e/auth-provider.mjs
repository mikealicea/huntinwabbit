// Test-only HTTP boundary. Never imported by application code or deployed.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

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
  if (url.pathname === '/') {
    if (!active) return error(401, 'unauthorized');
    if (active.account.helloFailure) return error(503, 'unavailable');
    return send(200, { message: 'Hello, world!' });
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
