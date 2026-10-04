import * as z from "zod";

import { uniqueStrings } from "./internal.ts";
import { idempotencyKeySchema } from "./http.ts";
import { moduleKeySchema, moduleTierSchema, subscriptionStatusSchema } from "./entitlement.ts";
import { organizationNameSchema } from "./organization.ts";
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

/** How a limited dimension behaves when the limit is reached (prd.md 7.1). */
export const usageEnforcementSchema = limitEnforcementTypeSchema.exclude(["CAPABILITY_GATE"]);

/** OK below 80%, NEAR from 80%, REACHED at the limit, OVER above it. */
export const usageStateSchema = z.enum(["NEAR", "OK", "OVER", "REACHED"]);

/** One dimension of a workspace: what is used against what the package allows. */
export const usageMeterSchema = z.object({
  dimensionKey: limitDimensionKeySchema,
  enforcement: usageEnforcementSchema,
  /** Null when the package does not cap this dimension. */
  limit: usageQuantitySchema.nullable(),
  /** Set for dimensions that add up over a billing cycle; null for counts of what exists. */
  periodEnd: z.iso.datetime().nullable(),
  periodStart: z.iso.datetime().nullable(),
  state: usageStateSchema,
  unit: z.string().trim().min(1).max(20),
  unlimited: z.boolean(),
  used: usageQuantitySchema,
});

export const usageSummarySchema = z.object({ meters: z.array(usageMeterSchema) });

/**
 * What a merchant sees about their own subscription: the package, the
 * commercial modules it includes with their tiers, and usage against limits.
 */
export const subscriptionOverviewSchema = z.object({
  meters: z.array(usageMeterSchema),
  modules: z.array(z.object({ key: moduleKeySchema, tier: moduleTierSchema })),
  subscription: z
    .object({
      /** When the current billing cycle ends; null for an open-ended cycle. */
      cycleEndsAt: z.iso.datetime().nullable(),
      endsAt: z.iso.datetime().nullable(),
      graceEndsAt: z.iso.datetime().nullable(),
      planName: organizationNameSchema,
      status: subscriptionStatusSchema,
    })
    .nullable(),
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

export type UsageMeter = z.infer<typeof usageMeterSchema>;

export type UsageState = z.infer<typeof usageStateSchema>;

export type UsageSummary = z.infer<typeof usageSummarySchema>;

export type SubscriptionOverview = z.infer<typeof subscriptionOverviewSchema>;
