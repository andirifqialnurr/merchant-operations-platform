import { PrismaInventoryCategoryStatusWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-category-status-writer.ts";
import { SetInventoryCategoryStatus } from "../src/modules/inventory/application/set-inventory-category-status.ts";
import { fixture as renameFixture } from "./inventory-category-update-fixture.mjs";

export {
  attempt,
  category,
  denied,
  snapshot,
  waitForBlocked,
} from "./inventory-category-update-fixture.mjs";
export const scopeOf = (identity) => `inventory.category.status_change:${identity.userId}`;

export async function fixture(db) {
  const setup = await renameFixture(db);
  const statusWriter = new PrismaInventoryCategoryStatusWriter();
  return {
    ...setup,
    renamer: setup.command,
    statusWriter,
    command: new SetInventoryCategoryStatus(setup.authorizer, statusWriter),
  };
}
