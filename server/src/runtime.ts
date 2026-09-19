import { buildApp } from './app.ts';
import {
  authConfig,
  createAccessTokenVerifier,
} from './features/auth/auth.index.ts';

export function buildRuntimeApp(
  env: Record<string, string | undefined> = process.env,
) {
  const verifyAccessToken = createAccessTokenVerifier(authConfig(env));
  return buildApp({ verifyAccessToken });
}
