import 'server-only';
export function apiConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const stage =
    env.APP_STAGE ?? (env.NODE_ENV === 'development' ? 'dev' : undefined);
  if (stage !== 'dev' && stage !== 'prod')
    throw new Error('APP_STAGE must be dev or prod.');
  const value = stage === 'dev' ? env.API_BASE_URL_DEV : env.API_BASE_URL_PROD;
  if (!value)
    throw new Error('The selected API stage requires its API_BASE_URL.');
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' &&
      !(stage === 'dev' && local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'API_BASE_URL must be an HTTPS origin (dev permits loopback HTTP).',
    );
  return { stage, origin: url.origin };
}
