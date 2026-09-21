import { type ChildProcess, spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

import { createFetchPosting } from './job-parsing.fetch.ts';
import { FETCH_WORKER_SOURCE } from './job-parsing.worker.ts';

function workerWithProvider(result: unknown): ChildProcess {
  const fixtureModule = `data:text/javascript,${encodeURIComponent(`export async function httpFetch() { return ${JSON.stringify(result)}; }`)}`;
  // Replace only the external module boundary; execute the real worker program.
  const source = FETCH_WORKER_SOURCE.replace(
    "import('@teng-lin/agent-fetch')",
    `import(${JSON.stringify(fixtureModule)})`,
  );
  return launchScript(source);
}

function launchScript(script: string): ChildProcess {
  return spawn(process.execPath, ['--eval', script], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
}

describe('isolated fetch adapter', () => {
  it.each([
    [{ success: false, statusCode: 403 }, 'SOURCE_BLOCKED'],
    [{ success: false, statusCode: 404 }, 'SOURCE_EXPIRED'],
    [{ success: false, statusCode: 410 }, 'SOURCE_EXPIRED'],
    [{ success: false, statusCode: 429 }, 'RATE_LIMITED'],
    [{ success: false, error: 'response_too_large' }, 'SOURCE_TOO_LARGE'],
    [{ success: false, error: 'network_error' }, 'SOURCE_UNAVAILABLE'],
    [{ success: true }, 'SOURCE_UNAVAILABLE'],
    [{ success: true, markdown: 'x'.repeat(100_001) }, 'SOURCE_TOO_LARGE'],
  ])('maps actual worker provider outcomes safely', async (result, code) => {
    const parse = createFetchPosting({
      launch: () => workerWithProvider(result),
    });
    await expect(
      parse('https://example.com', new AbortController().signal),
    ).rejects.toMatchObject({ code });
  });

  it.each([
    [
      {
        success: true,
        title: 'Role',
        markdown: 'Markdown description',
        textContent: 'Unused fallback',
      },
      'Role\n\nMarkdown description',
    ],
    [
      { success: true, textContent: 'Plain text description' },
      'Plain text description',
    ],
  ])(
    'extracts available content without forwarding raw HTML or metadata',
    async (result, content) => {
      const parse = createFetchPosting({
        launch: () => workerWithProvider(result),
      });
      expect(
        (await parse('https://example.com', new AbortController().signal))
          .content,
      ).toBe(content);
    },
  );
  it('receives bounded content and reaps the process before resolving', async () => {
    let child: ChildProcess | undefined;
    const parse = createFetchPosting({
      launch: () => {
        child = launchScript(
          `process.once('message', () => process.send({ok:true,content:'fictional posting'})); process.send({ready:true}); setInterval(()=>{},1000);`,
        );
        return child;
      },
    });
    const result = await parse(
      'https://example.com/private-job',
      new AbortController().signal,
    );
    expect(result.content).toBe('fictional posting');
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
    expect(child?.signalCode).toBe('SIGKILL');
    expect(child?.connected).toBe(false);
    expect(JSON.stringify(child?.spawnargs)).not.toContain('private-job');
  });

  it.each([
    'SOURCE_BLOCKED',
    'SOURCE_EXPIRED',
    'RATE_LIMITED',
    'SOURCE_TOO_LARGE',
    'SOURCE_UNAVAILABLE',
    'FETCH_FAILED',
  ])('preserves safe failure %s', async (code) => {
    const parse = createFetchPosting({
      launch: () =>
        launchScript(
          `process.once('message', () => process.send(${JSON.stringify({ ok: false, code })}));process.send({ready:true});`,
        ),
    });
    await expect(
      parse('https://example.com', new AbortController().signal),
    ).rejects.toMatchObject({ code });
  });

  it.each([
    `process.send({ok:true,content:'unexpected-before-ready'});`,
    `process.once('message',()=>process.send({ok:true,content:42}));process.send({ready:true});`,
    `process.exit(1);`,
  ])('rejects broken worker protocols and crashes', async (script) => {
    await expect(
      createFetchPosting({ launch: () => launchScript(script) })(
        'https://example.com',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('kills and reaps a hung process at the deadline', async () => {
    const child = launchScript('setInterval(()=>{},1000);');
    await expect(
      createFetchPosting({ launch: () => child, timeoutMs: 30 })(
        'https://example.com',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'PARSE_TIMEOUT' });
    expect(child.signalCode).toBe('SIGKILL');
    expect(child.connected).toBe(false);
  });

  it('kills a process when its request is cancelled', async () => {
    const child = launchScript('setInterval(()=>{},1000);');
    const controller = new AbortController();
    const pending = createFetchPosting({ launch: () => child })(
      'https://example.com',
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'PARSE_TIMEOUT' });
    expect(child.signalCode).toBe('SIGKILL');
  });

  it('does not launch after cancellation and handles spawn failures', async () => {
    const launch = vi.fn(() => {
      throw new Error('private spawn error');
    });
    const parse = createFetchPosting({ launch });
    await expect(
      parse('https://example.com', AbortSignal.abort()),
    ).rejects.toMatchObject({ code: 'PARSE_TIMEOUT' });
    expect(launch).not.toHaveBeenCalled();
    await expect(
      parse('https://example.com', new AbortController().signal),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('loads the actual library in an isolated child and rejects a loopback target without a network request', async () => {
    await expect(
      createFetchPosting()(
        'http://127.0.0.1/job',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  }, 10_000);
});
