import type { NextFunction, Request, Response } from 'express';

/**
 * Typed application error. Services throw these; the error middleware maps
 * them to the contract's envelope `{ "message": "…" }` with the right status.
 * `message` is shown to the user for 400/409/5xx — write it accordingly.
 */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    statusCode: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
    this.statusCode = statusCode;
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
      console.error(
        'AppError',
        error.statusCode,
        error.message,
        error.cause ?? '',
      );
    }
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error('Unhandled error', error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
