import { z } from 'zod';

const hostname = z
  .string()
  .max(253)
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
  );
export const guidanceRequestSchema = z.strictObject({ hostname });
export const guidanceResponseSchema = z.strictObject({
  hostname,
  recommendSourceText: z.boolean(),
});
