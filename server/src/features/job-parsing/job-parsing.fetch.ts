import { type ChildProcess, spawn } from 'node:child_process';
import { z } from 'zod';

import { FETCH_TIMEOUT_MS } from './job-parsing.config.ts';
import { parsingError } from './job-parsing.errors.ts';
import {
  type FetchPosting,
  MAX_SOURCE_CHARACTERS,
} from './job-parsing.schemas.ts';
import { FETCH_WORKER_SOURCE } from './job-parsing.worker.ts';

const workerResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    content: z.string().trim().min(1).max(MAX_SOURCE_CHARACTERS),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.enum([
      'SOURCE_BLOCKED',
      'SOURCE_EXPIRED',
      'RATE_LIMITED',
      'SOURCE_TOO_LARGE',
      'SOURCE_UNAVAILABLE',
      'FETCH_FAILED',
    ]),
  }),
]);

export function launchFetchWorker(): ChildProcess {
  return spawn(
    process.execPath,
    ['--input-type=module', '--eval', FETCH_WORKER_SOURCE],
    {
      cwd: process.cwd(),
      env: { NODE_ENV: 'production', LOG_LEVEL: 'fatal' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
}

export function createFetchPosting(
  options: { launch?: () => ChildProcess; timeoutMs?: number } = {},
): FetchPosting {
  return (url, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(parsingError('PARSE_TIMEOUT'));
        return;
      }
      let child: ChildProcess;
      try {
        child = (options.launch ?? launchFetchWorker)();
      } catch (cause) {
        reject(parsingError('FETCH_FAILED', cause));
        return;
      }
      let result: z.infer<typeof workerResultSchema> | undefined;
      let failure: Error | undefined;
      let sent = false;
      function stop(error: Error): void {
        failure ??= error;
        child.kill('SIGKILL');
      }
      const abort = () => stop(parsingError('PARSE_TIMEOUT'));
      const timer = setTimeout(abort, options.timeoutMs ?? FETCH_TIMEOUT_MS);
      signal.addEventListener('abort', abort, { once: true });
      child.on('error', (cause) => stop(parsingError('FETCH_FAILED', cause)));
      child.on('message', (message: unknown) => {
        if (
          !sent &&
          message &&
          typeof message === 'object' &&
          'ready' in message &&
          message.ready === true
        ) {
          sent = true;
          child.send({ url, limit: MAX_SOURCE_CHARACTERS }, (cause) => {
            if (cause) stop(parsingError('FETCH_FAILED', cause));
          });
          return;
        }
        const parsed = workerResultSchema.safeParse(message);
        if (!sent || result || !parsed.success) {
          stop(parsingError('FETCH_FAILED'));
          return;
        }
        result = parsed.data;
        // Receiving a result is not completion: the child must exit before ownership ends.
        child.kill('SIGKILL');
      });
      child.once('close', () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        if (failure) reject(failure);
        else if (!result) reject(parsingError('FETCH_FAILED'));
        else if (!result.ok) reject(parsingError(result.code));
        else
          resolve({
            content: result.content,
            fetchedAt: new Date().toISOString(),
          });
      });
      if (signal.aborted) abort();
    });
}
