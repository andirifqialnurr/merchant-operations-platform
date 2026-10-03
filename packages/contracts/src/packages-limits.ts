import * as z from "zod";

import { uniqueStrings } from "./internal.ts";
import { idempotencyKeySchema } from "./http.ts";
import { moduleKeySchema, moduleTierSchema } from "./entitlement.ts";
import { capabilityKeySchema } from "./module-manifest.ts";

export const packageKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const limitEnforcementTypeSchema = z.enum([
  "CAPABILITY_GATE",
  "HARD_COUNT",
  "SOFT_METERED",
  "THROTTLED",
]);

export const limitDimensionKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);

export const usageQuantitySchema = z.string().regex(/^(?:0|[1-9][0-9]{0,17})$/);

export const packageVersionModuleSchema = z.object({
  capabilities: z.array(capabilityKeySchema).refine(uniqueStrings, {
    message: "Capability package tidak boleh duplikat.",
  }),
  moduleKey: moduleKeySchema,
  tier: moduleTierSchema,
});

export const packageVersionLimitSchema = z
  .object({
    dimensionKey: limitDimensionKeySchema,
    enforcement: limitEnforcementTypeSchema,
    limitValue: usageQuantitySchema.nullable(),
    unlimited: z.boolean(),
  })
  .refine((value) => value.unlimited || value.limitValue !== null, {
    message: "Limit terbatas wajib memiliki limitValue.",
    path: ["limitValue"],
  })
  .refine((value) => !value.unlimited || value.limitValue === null, {
    message: "Limit unlimited tidak boleh memiliki limitValue.",
    path: ["limitValue"],
  });

export const packageVersionSnapshotSchema = z.object({
  createdAt: z.iso.datetime(),
  modules: z.array(packageVersionModuleSchema),
  packageKey: packageKeySchema,
  publishedAt: z.iso.datetime(),
  version: z.number().int().min(1),
  limits: z.array(packageVersionLimitSchema),
});

export const effectiveLimitSourceSchema = z.enum(["ADDON", "OVERRIDE", "PACKAGE", "SAFETY_CAP"]);

export const effectiveLimitSchema = packageVersionLimitSchema.extend({
  source: effectiveLimitSourceSchema,
});

export const usageEventSchema = z.object({
  dimensionKey: limitDimensionKeySchema,
  id: z.uuid(),
  idempotencyKey: idempotencyKeySchema,
  occurredAt: z.iso.datetime(),
  quantity: usageQuantitySchema,
  receivedAt: z.iso.datetime(),
  sourceRecordId: z.string().trim().min(1).max(160).nullable(),
  sourceRecordType: z.string().trim().min(1).max(120),
  workspaceId: z.uuid(),
});

export const usageCounterSchema = z.object({
  dimensionKey: limitDimensionKeySchema,
  effectiveLimit: effectiveLimitSchema,
  periodEnd: z.iso.datetime(),
  periodStart: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  used: usageQuantitySchema,
  workspaceId: z.uuid(),
});

export const usageAdjustmentSchema = z.object({
  actorId: z.uuid(),
  dimensionKey: limitDimensionKeySchema,
  id: z.uuid(),
  quantityDelta: z.string().regex(/^-?(?:0|[1-9][0-9]{0,17})$/),
  reason: z.string().trim().min(3).max(500),
  recordedAt: z.iso.datetime(),
  workspaceId: z.uuid(),
});

export const limitErrorCodeSchema = z.enum([
  "ENTITLEMENT_REQUIRED",
  "INSTALLATION_SETUP_REQUIRED",
  "LIMIT_REACHED",
  "RATE_LIMITED",
  "SUBSCRIPTION_SUSPENDED",
  "TIER_UPGRADE_REQUIRED",
]);

export const limitErrorDetailsSchema = z.object({
  allowedAction: z.string().trim().min(1).max(160).nullable(),
  code: limitErrorCodeSchema,
  currentUsage: usageQuantitySchema.nullable(),
  dimensionKey: limitDimensionKeySchema.nullable(),
  effectiveLimit: effectiveLimitSchema.nullable(),
  message: z.string().trim().min(1).max(500),
});

export type EffectiveLimit = z.infer<typeof effectiveLimitSchema>;

export type EffectiveLimitSource = z.infer<typeof effectiveLimitSourceSchema>;

export type LimitDimensionKey = z.infer<typeof limitDimensionKeySchema>;

export type LimitEnforcementType = z.infer<typeof limitEnforcementTypeSchema>;

export type LimitErrorCode = z.infer<typeof limitErrorCodeSchema>;

export type LimitErrorDetails = z.infer<typeof limitErrorDetailsSchema>;

export type PackageKey = z.infer<typeof packageKeySchema>;

export type PackageVersionLimit = z.infer<typeof packageVersionLimitSchema>;

export type PackageVersionModule = z.infer<typeof packageVersionModuleSchema>;

export type PackageVersionSnapshot = z.infer<typeof packageVersionSnapshotSchema>;

export type UsageAdjustment = z.infer<typeof usageAdjustmentSchema>;

export type UsageCounter = z.infer<typeof usageCounterSchema>;

export type UsageEvent = z.infer<typeof usageEventSchema>;

export type UsageQuantity = z.infer<typeof usageQuantitySchema>;
