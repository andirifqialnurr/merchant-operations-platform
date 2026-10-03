import type { ModuleKey } from "@merchant/contracts";

import type { ModuleTier } from "./access-evaluator.js";

export type PackageCapability = { capabilityKey: string; included: boolean };
export type PackageLimit = { dimensionKey: string; unlimited: boolean; value: bigint | null };

/** A capability or limit override, with the period it applies in. */
export type TargetOverride = {
  effectiveAt: Date;
  endsAt: Date | null;
  operation: "ADD" | "GRANT" | "REPLACE" | "REVOKE";
  targetKey: string;
  targetType: "CAPABILITY" | "LIMIT";
  value: bigint | null;
};

export type EffectiveLimit = PackageLimit & { source: "OVERRIDE" | "PACKAGE" };

export type EffectiveEntitlementRow = {
  capabilities: string[];
  limits: EffectiveLimit[];
  moduleKey: ModuleKey;
  tier: ModuleTier;
};

/** Overrides that have started and not ended at `now`, oldest first. */
function inForce(
  overrides: readonly TargetOverride[],
  type: TargetOverride["targetType"],
  now: Date,
) {
  return overrides
    .filter(
      (item) =>
        item.targetType === type &&
        item.effectiveAt <= now &&
        (item.endsAt === null || item.endsAt > now),
    )
    .sort((left, right) => left.effectiveAt.getTime() - right.effectiveAt.getTime());
}

/** What the package includes, then each override in the order it was made. */
export function effectiveCapabilities(
  packageCapabilities: readonly PackageCapability[],
  overrides: readonly TargetOverride[],
  now: Date,
) {
  const capabilities = new Set(
    packageCapabilities.filter((item) => item.included).map((item) => item.capabilityKey),
  );
  for (const override of inForce(overrides, "CAPABILITY", now)) {
    if (override.operation === "GRANT") capabilities.add(override.targetKey);
    if (override.operation === "REVOKE") capabilities.delete(override.targetKey);
  }
  return [...capabilities].sort();
}

/**
 * The package's limits with overrides applied in the order they were made:
 * REPLACE sets the number, ADD raises it. Adding to "unlimited" leaves it
 * unlimited; adding to a dimension the package does not limit starts from zero.
 */
export function effectiveLimits(
  packageLimits: readonly PackageLimit[],
  overrides: readonly TargetOverride[],
  now: Date,
) {
  const limits = new Map<string, EffectiveLimit>(
    packageLimits.map((item) => [item.dimensionKey, { ...item, source: "PACKAGE" }]),
  );
  for (const override of inForce(overrides, "LIMIT", now)) {
    if (override.value === null) continue;
    const current = limits.get(override.targetKey);
    if (override.operation === "REPLACE") {
      limits.set(override.targetKey, {
        dimensionKey: override.targetKey,
        source: "OVERRIDE",
        unlimited: false,
        value: override.value,
      });
    } else if (override.operation === "ADD" && !current?.unlimited) {
      limits.set(override.targetKey, {
        dimensionKey: override.targetKey,
        source: "OVERRIDE",
        unlimited: false,
        value: (current?.value ?? 0n) + override.value,
      });
    }
  }
  return [...limits.values()].sort((left, right) =>
    left.dimensionKey.localeCompare(right.dimensionKey),
  );
}

/**
 * Which module owns which key namespace (the part before the first dot of a
 * capability or limit key). Interim: module manifests will declare this
 * (M2-BE-07). Anything unclaimed is kept on the subscription module's row, so
 * nothing the tenant is entitled to disappears from the projection.
 */
const MODULE_NAMESPACES: Partial<Record<ModuleKey, readonly string[]>> = {
  CAFE_PROFILE: ["profile"],
  CORE_CATALOG: ["catalog"],
  CORE_TENANCY: ["core"],
  CUSTOMER_BASIC: ["customer"],
  FINANCE_BASIC: ["finance"],
  INVENTORY_BASIC: ["inventory"],
  KDS: ["kds"],
  POS: ["pos"],
  TABLE_SELF_ORDER: ["floor", "self_order"],
};
const UNCLAIMED_OWNER: ModuleKey = "CORE_SUBSCRIPTION";

const namespaceOf = (key: string) => key.slice(0, key.indexOf("."));

/** One projection row per enabled module, carrying the capabilities and limits it owns. */
export function buildEffectiveEntitlementRows(
  modules: ReadonlyArray<{ moduleKey: ModuleKey; tier: ModuleTier }>,
  capabilities: readonly string[],
  limits: readonly EffectiveLimit[],
): EffectiveEntitlementRow[] {
  const ownerOf = new Map<string, ModuleKey>();
  for (const { moduleKey } of modules) {
    for (const namespace of MODULE_NAMESPACES[moduleKey] ?? []) ownerOf.set(namespace, moduleKey);
  }
  const fallback = modules.some((item) => item.moduleKey === UNCLAIMED_OWNER)
    ? UNCLAIMED_OWNER
    : undefined;
  const owner = (key: string) => ownerOf.get(namespaceOf(key)) ?? fallback;

  return modules
    .map(({ moduleKey, tier }) => ({
      capabilities: capabilities.filter((key) => owner(key) === moduleKey),
      limits: limits.filter((limit) => owner(limit.dimensionKey) === moduleKey),
      moduleKey,
      tier,
    }))
    .sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
}
