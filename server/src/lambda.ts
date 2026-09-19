import serverlessHttp from 'serverless-http';

import { buildRuntimeApp } from './runtime.ts';

type LambdaHandler = (event: unknown, context: unknown) => Promise<unknown>;

// Built lazily so the app is constructed at invocation time, not import time.
let cachedHandler: LambdaHandler | undefined;

function buildHandler(): LambdaHandler {
  return serverlessHttp(buildRuntimeApp()) as LambdaHandler;
}

export async function handler(
  event: unknown,
  context: unknown,
): Promise<unknown> {
  cachedHandler ??= buildHandler();
  return cachedHandler(event, context);
}
