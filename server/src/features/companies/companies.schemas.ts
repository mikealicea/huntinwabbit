import { z } from 'zod';
export const companyInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(4_000),
  website: z
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password
      );
    })
    .nullable()
    .default(null),
});
export const companySchema = companyInputSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const companySummarySchema = companySchema.pick({
  id: true,
  name: true,
  website: true,
});
export const companyAssociationSchema = z.strictObject({
  company: companySummarySchema.nullable(),
  mode: z.enum(['automatic', 'manual']),
  revision: z.number().int().nonnegative(),
});
export const companySelectionSchema = z.strictObject({
  expectedRecordVersion: z.number().int().nonnegative(),
  selection: z.union([
    z.strictObject({ id: z.uuid() }),
    z.strictObject({ create: companyInputSchema }),
    z.null(),
  ]),
});
export const companyQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(2048).optional(),
  q: z.string().trim().max(500).optional(),
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-4]\d|50)$/)
    .transform(Number)
    .default(50),
});
export type Company = z.infer<typeof companySchema>;
export type CompanyAssociation = z.infer<typeof companyAssociationSchema>;
export type CompanySelection = z.infer<typeof companySelectionSchema>;
