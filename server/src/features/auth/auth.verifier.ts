import {
  createRemoteJWKSet,
  customFetch,
  errors,
  type JWTPayload,
  jwtVerify,
} from 'jose';

import { unauthorized, unavailable } from '../../shared/shared.errors.ts';
import type { authConfig } from './auth.config.ts';
import type { VerifyAccessToken } from './auth.types.ts';

export function createAccessTokenVerifier(
  config: ReturnType<typeof authConfig>,
  fetchKeys: typeof fetch = fetch,
): VerifyAccessToken {
  const keys = createRemoteJWKSet(config.jwksUrl, {
    [customFetch]: fetchKeys,
    cacheMaxAge: 600_000,
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });

  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        algorithms: ['ES256', 'RS256'],
        issuer: config.issuer,
        audience: 'authenticated',
        requiredClaims: ['sub', 'exp', 'role'],
      }));
    } catch (error) {
      if (
        error instanceof errors.JWTClaimValidationFailed ||
        error instanceof errors.JWTExpired ||
        error instanceof errors.JWTInvalid ||
        error instanceof errors.JWSInvalid ||
        error instanceof errors.JWSSignatureVerificationFailed ||
        error instanceof errors.JOSEAlgNotAllowed ||
        error instanceof errors.JOSENotSupported ||
        error instanceof errors.JWKSNoMatchingKey
      ) {
        throw unauthorized('Invalid or missing credentials.');
      }
      throw unavailable('Authentication is temporarily unavailable.', error);
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      !Number.isFinite(payload.exp) ||
      payload.role !== 'authenticated' ||
      (payload.is_anonymous !== undefined && payload.is_anonymous !== false)
    ) {
      throw unauthorized('Invalid or missing credentials.');
    }
    return { userId: payload.sub };
  };
}
