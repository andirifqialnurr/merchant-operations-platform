import { randomUUID } from "node:crypto";

import { PrismaInventoryItemUpdater } from "../src/modules/inventory/adapters/persistence/prisma-inventory-item-updater.ts";
import { UpdateInventoryItem } from "../src/modules/inventory/application/update-inventory-item.ts";
import { fixture as createFixture, unit } from "./inventory-item-create-fixture.mjs";

export {
  attempt,
  category,
  denied,
  snapshot,
  unit,
  waitForBlocked,
} from "./inventory-item-create-fixture.mjs";
export const scopeOf = (identity) => `inventory.item.update:${identity.userId}`;
export const dto = ({ id, name, sku, categoryId, baseUnitId, minStock, status }) => ({
  id,
  name,
  sku,
  categoryId,
  baseUnitId,
  minStock: minStock?.toFixed() ?? null,
  status,
});
export async function item(db, identity, extra = {}) {
  const baseUnitId = extra.baseUnitId ?? (await unit(db, identity)).id;
  return db.inventoryItem.create({
    data: { tenantId: identity.tenantId, name: `Original ${randomUUID()}`, baseUnitId, ...extra },
  });
}
export async function fixture(db) {
  const setup = await createFixture(db);
  const updater = new PrismaInventoryItemUpdater();
  return {
    ...setup,
    get policyReads() {
      return setup.policyReads;
    },
    itemCreator: setup.command,
    updater,
    command: new UpdateInventoryItem(setup.authorizer, updater),
  };
}
