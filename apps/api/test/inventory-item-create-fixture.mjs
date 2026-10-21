import { randomUUID } from "node:crypto";

import { MeteringService } from "../src/core/metering/metering.service.ts";
import { UsageGaugeRegistry } from "../src/shared/limits/limit-gate.ts";
import { PrismaInventoryItemWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-item-writer.ts";
import { CreateInventoryItem } from "../src/modules/inventory/application/create-inventory-item.ts";
import { fixture as categoryFixture } from "./inventory-category-status-fixture.mjs";

export { attempt, category, denied, waitForBlocked } from "./inventory-category-status-fixture.mjs";
export const scopeOf = (identity) => `inventory.item.create:${identity.userId}`;
export async function unit(db, identity, precision = 6) {
  return db.inventoryUnit.create({
    data: {
      tenantId: identity.tenantId,
      code: `U${randomUUID().slice(0, 8)}`,
      name: "Base unit",
      precision,
      dimension: "MASS",
    },
  });
}
export async function snapshot(db, tenantId) {
  const result = {};
  for (const [key, delegate] of Object.entries({
    items: db.inventoryItem,
    units: db.inventoryUnit,
    conversions: db.inventoryUnitConversion,
    categories: db.inventoryCategory,
    audits: db.auditLog,
    keys: db.idempotencyKey,
    outbox: db.outboxEvent,
    installs: db.coreModuleInstallation,
    usage: db.coreUsageEvent,
  }))
    result[key] = await delegate.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
  result.counters = await db.coreUsageCounter.findMany({
    where: { tenantId },
    orderBy: [{ dimensionKey: "asc" }, { periodStart: "asc" }],
  });
  return result;
}
export async function fixture(db) {
  const setup = await categoryFixture(db);
  const maxima = new Map();
  let policyReads = 0;
  const gauges = new UsageGaugeRegistry();
  // Real Core policy/check behavior, test-owned entitlement facts, no global gauge fallback.
  const metering = new MeteringService(
    {},
    {
      limitsInForce: async (tenantId) => {
        policyReads++;
        const value = maxima.get(tenantId) ?? null;
        return {
          cycle: null,
          limits: [
            {
              dimensionKey: "inventory.items.active",
              value,
              unlimited: value === null,
              source: "OVERRIDE",
            },
          ],
        };
      },
    },
    gauges,
  );
  const writer = new PrismaInventoryItemWriter(metering);
  return {
    ...setup,
    statusCommand: setup.command,
    writer,
    maxima,
    get policyReads() {
      return policyReads;
    },
    command: new CreateInventoryItem(setup.authorizer, writer),
  };
}
