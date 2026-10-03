import * as z from "zod";

import { organizationNameSchema } from "./organization.ts";

export const qrTokenStatusSchema = z.enum(["ACTIVE", "EXPIRED", "REVOKED", "ROTATED"]);

export const qrTokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const tableQrTokenRecordSchema = z
  .object({
    activatedAt: z.iso.datetime().nullable(),
    hash: qrTokenHashSchema,
    id: z.uuid(),
    locationId: z.uuid(),
    revokedAt: z.iso.datetime().nullable(),
    rotatedFromVersion: z.number().int().min(1).nullable(),
    status: qrTokenStatusSchema,
    tableId: z.uuid(),
    updatedAt: z.iso.datetime(),
    version: z.number().int().min(1),
    workspaceId: z.uuid(),
  })
  .strict()
  .refine((value) => value.status !== "ACTIVE" || value.activatedAt !== null, {
    message: "QR ACTIVE wajib memiliki activatedAt.",
    path: ["activatedAt"],
  })
  .refine((value) => value.status !== "REVOKED" || value.revokedAt !== null, {
    message: "QR REVOKED wajib memiliki revokedAt.",
    path: ["revokedAt"],
  });

export const publicQrResolutionStatusSchema = z.enum(["CLOSED", "INVALID", "READY", "RESOLVING"]);

export const publicQrResolutionSchema = z
  .object({
    merchantName: organizationNameSchema,
    message: z.string().trim().min(1).max(300).nullable(),
    outletName: organizationNameSchema.nullable(),
    status: publicQrResolutionStatusSchema,
    tableLabel: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export type PublicQrResolution = z.infer<typeof publicQrResolutionSchema>;

export type PublicQrResolutionStatus = z.infer<typeof publicQrResolutionStatusSchema>;

export type QrTokenStatus = z.infer<typeof qrTokenStatusSchema>;

export type TableQrTokenRecord = z.infer<typeof tableQrTokenRecordSchema>;
