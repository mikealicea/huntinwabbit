import type { NextFunction, Request, Response } from 'express';

/**
 * Two structured log lines per request — one on arrival, one on completion.
 * Never logs bodies.
 */
export function requestLogging(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  console.log(
    JSON.stringify({
      event: 'request.in',
      method: req.method,
    }),
  );
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        event: 'request.done',
        method: req.method,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });
  next();
}
