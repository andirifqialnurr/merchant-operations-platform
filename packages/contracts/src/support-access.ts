import * as z from "zod";

export const supportAccessScopeSchema = z.enum([
  "AUDIT_ONLY",
  "BILLING_SUPPORT",
  "CONFIGURATION_SUPPORT",
  "DATA_EXPORT_SUPPORT",
  "TECHNICAL_SUPPORT",
]);

export const supportAccessStatusSchema = z.enum(["ACTIVE", "EXPIRED", "REVOKED"]);

export const supportAccessGrantSchema = z
  .object({
    auditReference: z.string().trim().min(3).max(160),
    expiresAt: z.iso.datetime(),
    grantedAt: z.iso.datetime(),
    grantedByPlatformActorId: z.uuid(),
    id: z.uuid(),
    reason: z.string().trim().min(10).max(500),
    revokedAt: z.iso.datetime().nullable(),
    scope: supportAccessScopeSchema,
    status: supportAccessStatusSchema,
    supportActorId: z.uuid(),
    workspaceId: z.uuid(),
  })
  .strict()
  .refine((value) => value.status !== "REVOKED" || value.revokedAt !== null, {
    message: "Support access REVOKED wajib memiliki revokedAt.",
    path: ["revokedAt"],
  });

export type SupportAccessGrant = z.infer<typeof supportAccessGrantSchema>;

export type SupportAccessScope = z.infer<typeof supportAccessScopeSchema>;

export type SupportAccessStatus = z.infer<typeof supportAccessStatusSchema>;
