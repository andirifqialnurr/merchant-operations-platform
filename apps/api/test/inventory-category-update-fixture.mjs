import { randomUUID } from "node:crypto";

import { PrismaInventoryCategoryUpdater } from "../src/modules/inventory/adapters/persistence/prisma-inventory-category-updater.ts";
import { UpdateInventoryCategory } from "../src/modules/inventory/application/update-inventory-category.ts";
import { fixture as createFixture } from "./inventory-category-create-fixture.mjs";

export { attempt, denied, snapshot } from "./inventory-category-create-fixture.mjs";
export { waitForBlocked } from "./inventory-conversion-fixture.mjs";
export const scopeOf = (identity) => `inventory.category.update:${identity.userId}`;

export async function fixture(db) {
  const setup = await createFixture(db);
  const updater = new PrismaInventoryCategoryUpdater();
  return {
    ...setup,
    creator: setup.command,
    updater,
    command: new UpdateInventoryCategory(setup.authorizer, updater),
  };
}
export async function category(db, identity, extra = {}) {
  return db.inventoryCategory.create({
    data: {
      tenantId: identity.tenantId,
      name: `Original ${randomUUID()}`,
      status: "ACTIVE",
      ...extra,
    },
  });
}
