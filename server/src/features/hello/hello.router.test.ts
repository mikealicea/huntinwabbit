import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createHelloRouter } from './hello.router.ts';

function buildTestApp(): express.Express {
  const app = express();
  app.use(createHelloRouter());
  return app;
}

describe('GET /', () => {
  it('responds with a hello world message', async () => {
    const app = buildTestApp();

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello, world!' });
  });
});
