import type { LimitEnforcementType } from "@merchant/contracts";

export type UsageEnforcement = Exclude<LimitEnforcementType, "CAPABILITY_GATE">;

export type UsageDimension = {
  enforcement: UsageEnforcement;
  key: string;
  unit: string;
};

const hard = (key: string, unit = "count"): UsageDimension => ({
  enforcement: "HARD_COUNT",
  key,
  unit,
});
const soft = (key: string): UsageDimension => ({
  enforcement: "SOFT_METERED",
  key,
  unit: "event",
});

/**
 * The catalog of what a package can limit (Packages & Limits section 16).
 * The same rows are in `core_usage_dimensions`; a test keeps the two equal.
 */
export const USAGE_DIMENSIONS: readonly UsageDimension[] = [
  hard("core.business_units.active"),
  hard("core.locations.active"),
  hard("core.users.active", "seat"),
  hard("core.roles.custom"),
  hard("core.storage.gb", "GB"),
  hard("catalog.products.active"),
  hard("pos.registers.active", "device"),
  soft("pos.sales.completed.cycle"),
  hard("floor.tables.active_per_location"),
  hard("floor.floors.active_per_location"),
  hard("floor.areas.active_per_floor"),
  soft("self_order.orders.submitted.cycle"),
  hard("kds.devices.active", "device"),
  hard("kds.stations.active_per_location"),
  soft("kds.tickets.created.cycle"),
  hard("inventory.items.active"),
  hard("inventory.stock_locations.active"),
  soft("inventory.movements.posted.cycle"),
  hard("finance.accounts.active"),
  soft("finance.transactions.posted.cycle"),
  hard("hc.employees.active", "seat"),
  soft("hc.attendance.received.cycle"),
  hard("customer.profiles.active"),
  { enforcement: "THROTTLED", key: "reports.exports.cycle", unit: "job" },
  { enforcement: "THROTTLED", key: "api.requests.cycle", unit: "request" },
];

const byKey = new Map(USAGE_DIMENSIONS.map((item) => [item.key, item]));

export function usageDimension(key: string) {
  return byKey.get(key);
}

/**
 * A hard count is how many things exist right now (products, users). Soft and
 * throttled dimensions add up over a billing cycle and start again from zero.
 */
export function isCycleDimension(dimension: UsageDimension) {
  return dimension.enforcement !== "HARD_COUNT";
}

export type UsagePeriod = { end: Date; start: Date };

/**
 * The period a moment belongs to: the subscription's billing cycle when it
 * has a start and an end that contain the moment, otherwise the calendar
 * month in UTC.
 */
export function usagePeriod(
  moment: Date,
  cycle?: { endsAt: Date | null; startsAt: Date } | null,
): UsagePeriod {
  if (cycle?.endsAt && cycle.startsAt <= moment && moment < cycle.endsAt) {
    return { end: cycle.endsAt, start: cycle.startsAt };
  }
  const start = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1));
  const end = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth() + 1, 1));
  return { end, start };
}

export const LIMIT_THRESHOLDS = [80, 100] as const;
export type LimitThreshold = (typeof LIMIT_THRESHOLDS)[number];

/** The usage at which a threshold is reached, rounded up: 80% of 10 is 8, of 3 is 3. */
export function thresholdQuantity(limit: bigint, threshold: LimitThreshold) {
  return (limit * BigInt(threshold) + 99n) / 100n;
}

export type UsageState = "NEAR" | "OK" | "OVER" | "REACHED";

/** Where usage stands against its limit. No limit means it can never be near or over. */
export function usageState(used: bigint, limit: bigint | null): UsageState {
  if (limit === null) return "OK";
  if (used > limit) return "OVER";
  if (used === limit) return "REACHED";
  return used >= thresholdQuantity(limit, 80) ? "NEAR" : "OK";
}
