import { PrismaInventoryConversionUpdater } from "../src/modules/inventory/adapters/persistence/prisma-inventory-conversion-updater.ts";
import { UpdateInventoryUnitConversion } from "../src/modules/inventory/application/update-inventory-unit-conversion.ts";
import { fixture as createFixture, pair } from "./inventory-conversion-fixture.mjs";

export { attempt, denied, pair, waitForBlocked } from "./inventory-conversion-fixture.mjs";
export const scopeOf = (identity) => `inventory.unit_conversion.update:${identity.userId}`;

export async function fixture(db) {
  const setup = await createFixture(db);
  const updater = new PrismaInventoryConversionUpdater();
  return {
    ...setup,
    creator: setup.command,
    updater,
    command: new UpdateInventoryUnitConversion(setup.authorizer, updater),
  };
}
export async function conversion(db, identity, factor = "1000", dimension = "MASS", precision = 6) {
  const body = {
    ...(await pair(db, identity.tenantId, [dimension, dimension], precision)),
    factor,
  };
  return db.inventoryUnitConversion.create({ data: { ...body, tenantId: identity.tenantId } });
}
export async function snapshot(db, tenantId) {
  return {
    units: await db.inventoryUnit.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
    conversions: await db.inventoryUnitConversion.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    audits: await db.auditLog.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
    keys: await db.idempotencyKey.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
  };
}
