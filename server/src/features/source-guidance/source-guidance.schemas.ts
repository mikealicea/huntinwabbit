import { z } from 'zod';

export function normalizeSourceHostname(input: string): string {
  const hostname = input
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (
    hostname.length > 253 ||
    !hostname.includes('.') ||
    !hostname
      .split('.')
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    /^[\d.]+$/.test(hostname)
  )
    throw new Error('Invalid hostname');
  return hostname;
}
export const guidanceRequestSchema = z.strictObject({
  hostname: z
    .string()
    .max(254)
    .transform((value, ctx) => {
      try {
        return normalizeSourceHostname(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid hostname' });
        return z.NEVER;
      }
    }),
});
export const guidanceResponseSchema = z.strictObject({
  hostname: z.string(),
  recommendSourceText: z.boolean(),
});
export type SourceObservation = {
  hostname: string;
  outcome: 'blocked' | 'usable';
  // Timestamp at fetch start plus an invocation nonce, reused on storage retries.
  order: string;
};
export interface SourceGuidance {
  lookup: (hostname: string) => Promise<z.infer<typeof guidanceResponseSchema>>;
  observe: (observation: SourceObservation) => Promise<void>;
}
