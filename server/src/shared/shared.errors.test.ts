import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  badRequest,
  errorMiddleware,
  unauthorized,
  unavailable,
} from './shared.errors.ts';

function appThrowing(error: unknown): express.Express {
  const app = express();
  app.get('/', () => {
    throw error;
  });
  app.use(errorMiddleware);
  return app;
}

describe('errorMiddleware', () => {
  it('maps AppErrors to their status with the message envelope', async () => {
    const response = await request(
      appThrowing(badRequest('Please provide a value.')),
    ).get('/');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Please provide a value.',
    });
  });

  it('maps unauthorized to 401', async () => {
    const response = await request(
      appThrowing(unauthorized('Invalid or missing credentials.')),
    ).get('/');
    expect(response.status).toBe(401);
  });

  it('maps unavailable to 503', async () => {
    const response = await request(
      appThrowing(unavailable('Service is temporarily unavailable.')),
    ).get('/');
    expect(response.status).toBe(503);
  });

  it('maps unknown errors to a generic 500 without leaking internals', async () => {
    const response = await request(
      appThrowing(new Error('secret internal detail')),
    ).get('/');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: 'Something went wrong. Please try again.',
    });
  });
});
