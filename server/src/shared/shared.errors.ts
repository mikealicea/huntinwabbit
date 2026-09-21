import type { NextFunction, Request, Response } from 'express';

/**
 * Typed application error. Services throw these; the error middleware maps
 * them to the contract's envelope `{ "message": "…" }` with the right status.
 * `message` is public for every AppError — write it accordingly.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(
    statusCode: number,
    message: string,
    options?: { cause?: unknown; code?: string },
  ) {
    super(message, options);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options?.code;
  }
}

export function badRequest(message: string, cause?: unknown): AppError {
  return new AppError(400, message, { cause });
}

export function unauthorized(message: string): AppError {
  return new AppError(401, message);
}

export function forbidden(message: string): AppError {
  return new AppError(403, message);
}

export function notFound(message: string): AppError {
  return new AppError(404, message);
}

export function conflict(message: string): AppError {
  return new AppError(409, message);
}

export function unavailable(message: string, cause?: unknown): AppError {
  return new AppError(503, message, { cause });
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by arity — the 4th param must exist.
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      console.error({
        event: 'request.error',
        category: 'application',
        status: error.statusCode,
      });
    }
    if (error.statusCode === 401) res.set('WWW-Authenticate', 'Bearer');
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }

  // Express body-parser errors contain the submitted body: never serialize them.
  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
  ) {
    const tooLarge = error.type === 'entity.too.large';
    res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? 'The request body is too large.'
        : 'Provide a valid JSON request body.',
      code: tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON',
    });
    return;
  }

  console.error({
    event: 'request.error',
    category: 'unexpected',
    status: 500,
  });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
