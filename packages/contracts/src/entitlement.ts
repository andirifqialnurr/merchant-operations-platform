import * as z from "zod";

import { organizationRecordTimestampsSchema } from "./internal.ts";
import { organizationNameSchema, organizationSnapshotSchema } from "./organization.ts";

export const MODULES = {
  coreAudit: "CORE_AUDIT",
  coreBill: "CORE_BILL",
  coreCatalog: "CORE_CATALOG",
  coreIdentity: "CORE_IDENTITY",
  coreOrder: "CORE_ORDER",
  corePaymentLedger: "CORE_PAYMENT_LEDGER",
  coreSubscription: "CORE_SUBSCRIPTION",
  coreTenancy: "CORE_TENANCY",
  cafeProfile: "CAFE_PROFILE",
  customerBasic: "CUSTOMER_BASIC",
  financeBasic: "FINANCE_BASIC",
  inventoryBasic: "INVENTORY_BASIC",
  kds: "KDS",
  pos: "POS",
  tableSelfOrder: "TABLE_SELF_ORDER",
} as const;

export const PLAN_CODES = {
  cafeDigital: "CAFE_DIGITAL",
  cafeOperations: "CAFE_OPERATIONS",
  customModular: "CUSTOM_MODULAR",
  posBasic: "POS_BASIC",
  profile: "PROFILE",
} as const;

export const moduleKeySchema = z.enum(Object.values(MODULES));

export const planCodeSchema = z.enum(Object.values(PLAN_CODES));

export const moduleKindSchema = z.enum(["CORE", "COMMERCIAL"]);

export const moduleTierSchema = z.enum(["ADVANCED", "BASIC", "PRO"]);

/**
 * DRAFT is prepared but not started and gives no access.
 * CANCELED_AT_PERIOD_END stays usable until `endsAt`.
 */
export const subscriptionStatusSchema = z.enum([
  "TRIAL",
  "ACTIVE",
  "GRACE",
  "SUSPENDED",
  "TERMINATED",
  "DRAFT",
  "CANCELED_AT_PERIOD_END",
]);

export const entitlementSourceSchema = z.enum(["CORE", "PLAN", "OVERRIDE", "DEPENDENCY", "NONE"]);

export const replaceSubscriptionSchema = z.object({
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable().optional(),
  graceEndsAt: z.iso.datetime().nullable().optional(),
});

export const setTenantEntitlementSchema = z.object({
  moduleKey: moduleKeySchema,
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(500),
  /** When the override stops applying; omitted or null keeps it until changed. */
  endsAt: z.iso.datetime().nullable().optional(),
});

export const platformEntitlementParamsSchema = z.object({
  id: z.uuid(),
  moduleKey: moduleKeySchema,
});

export const platformSetTenantEntitlementSchema = setTenantEntitlementSchema.omit({
  moduleKey: true,
});

const entitlementOverrideSchema = z.object({
  actorId: z.uuid().nullable(),
  effectiveAt: z.iso.datetime(),
  enabled: z.boolean(),
  endsAt: z.iso.datetime().nullable(),
  reason: z.string().min(1).max(500),
});

export const subscriptionSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  planCode: planCodeSchema,
  planName: organizationNameSchema,
  /** Version of the package this subscription bought; it never changes afterwards. */
  packageVersion: z.number().int().min(1),
  status: subscriptionStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  graceEndsAt: z.iso.datetime().nullable(),
  cycleStartsAt: z.iso.datetime(),
  cycleEndsAt: z.iso.datetime().nullable(),
});

export const moduleEntitlementSchema = z.object({
  key: moduleKeySchema,
  name: organizationNameSchema,
  kind: moduleKindSchema,
  enabled: z.boolean(),
  /** Tier the tenant has for this module; null while the module is off. */
  tier: moduleTierSchema.nullable(),
  source: entitlementSourceSchema,
  reason: z.string().min(1),
  planDefault: z.boolean(),
  override: entitlementOverrideSchema.nullable(),
  requiredBy: z.array(moduleKeySchema),
});

export const entitlementSnapshotSchema = z.object({
  subscription: subscriptionSchema.nullable(),
  modules: z.array(moduleEntitlementSchema),
});

export const platformTenantMasterSchema = z.object({
  entitlement: entitlementSnapshotSchema,
  organization: organizationSnapshotSchema,
});

export type ModuleEntitlement = z.infer<typeof moduleEntitlementSchema>;

export type ModuleKey = z.infer<typeof moduleKeySchema>;

export type ModuleKind = z.infer<typeof moduleKindSchema>;

export type ModuleTier = z.infer<typeof moduleTierSchema>;

export type PlanCode = z.infer<typeof planCodeSchema>;

export type PlatformEntitlementParams = z.infer<typeof platformEntitlementParamsSchema>;

export type PlatformSetTenantEntitlement = z.infer<typeof platformSetTenantEntitlementSchema>;

export type PlatformTenantMaster = z.infer<typeof platformTenantMasterSchema>;

export type ReplaceSubscription = z.infer<typeof replaceSubscriptionSchema>;

export type SetTenantEntitlement = z.infer<typeof setTenantEntitlementSchema>;

export type Subscription = z.infer<typeof subscriptionSchema>;

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;
