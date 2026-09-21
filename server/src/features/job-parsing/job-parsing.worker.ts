/**
 * Standalone ESM program passed to Node, never interpolated with user input.
 * Keep it as source text: bundler/test transforms of a function's toString()
 * introduce closures that are unavailable in the isolated child process.
 * The parent validates IPC and suppresses all vendor stdout/stderr.
 */
export const FETCH_WORKER_SOURCE = String.raw`
  function reply(message) {
    process.send?.(message, () => process.exit(0));
  }
  process.once('message', async (input) => {
    if (
      !input ||
      typeof input !== 'object' ||
      !('url' in input) ||
      typeof input.url !== 'string' ||
      !('limit' in input) ||
      typeof input.limit !== 'number'
    ) {
      reply({ ok: false, code: 'FETCH_FAILED' });
      return;
    }
    try {
      const { httpFetch } = await import('@teng-lin/agent-fetch');
      const result = await httpFetch(input.url, { timeout: 10_000 });
      if (!result.success) {
        const code =
          result.statusCode === 403
            ? 'SOURCE_BLOCKED'
            : result.statusCode === 404 || result.statusCode === 410
              ? 'SOURCE_EXPIRED'
              : result.statusCode === 429
                ? 'RATE_LIMITED'
                : result.error === 'response_too_large'
                  ? 'SOURCE_TOO_LARGE'
                  : 'SOURCE_UNAVAILABLE';
        reply({ ok: false, code });
        return;
      }
      const content = [result.title, result.markdown || result.textContent]
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (!content) reply({ ok: false, code: 'SOURCE_UNAVAILABLE' });
      else if (content.length > input.limit)
        reply({ ok: false, code: 'SOURCE_TOO_LARGE' });
      else reply({ ok: true, content });
    } catch {
      reply({ ok: false, code: 'FETCH_FAILED' });
    }
  });
  process.send?.({ ready: true });
`;
