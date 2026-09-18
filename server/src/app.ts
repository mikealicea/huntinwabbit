import express from 'express';

import { createHelloRouter } from './features/hello/hello.index.ts';
import { errorMiddleware } from './shared/shared.errors.ts';
import { requestLogging } from './shared/shared.middleware.ts';

export function buildApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(requestLogging);

  app.get('/health', (_req, res): void => {
    res.json({ message: 'ok' });
  });

  app.use(createHelloRouter());

  app.use(errorMiddleware);

  return app;
}
