import type { RequestHandler } from 'express';

import { unauthorized } from '../../shared/shared.errors.ts';
import type { AuthLocals, VerifyAccessToken } from './auth.types.ts';

export function requireAuthentication(
  verifyAccessToken: VerifyAccessToken,
): RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  unknown,
  AuthLocals
> {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Node can discard duplicates; inspect raw headers when available. serverless-http
    // leaves rawHeaders empty; Function URL duplicates are comma-joined and fail the regex.
    const count = req.rawHeaders.filter(
      (header, index) =>
        index % 2 === 0 && header.toLowerCase() === 'authorization',
    ).length;
    const match = /^Bearer ([^\s,]+)$/i.exec(req.headers.authorization ?? '');
    if (count > 1 || !match?.[1]) {
      throw unauthorized('Invalid or missing credentials.');
    }
    res.locals.identity = await verifyAccessToken(match[1]);
    next();
  };
}
