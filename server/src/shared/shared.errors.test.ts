import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  badRequest,
  errorMiddleware,
  unauthorized,
  unavailable,
} from './shared.errors.ts';

afterEach(() => vi.restoreAllMocks());

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
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('maps unavailable to 503', async () => {
    const response = await request(
      appThrowing(unavailable('Service is temporarily unavailable.')),
    ).get('/');
    expect(response.status).toBe(503);
  });

  it('maps unknown errors to a generic 500 without leaking internals', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(
      appThrowing(new Error('secret internal detail')),
    ).get('/');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: 'Something went wrong. Please try again.',
    });
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: 'request.error',
      category: 'unexpected',
      status: 500,
    });
  });

  it('preserves causes internally but omits error details from logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('private-provider-payload');
    const error = unavailable('A safe public message.', cause);
    expect(error.cause).toBe(cause);
    expect((await request(appThrowing(error)).get('/')).status).toBe(503);
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: 'request.error',
      category: 'application',
      status: 503,
    });
  });
});
