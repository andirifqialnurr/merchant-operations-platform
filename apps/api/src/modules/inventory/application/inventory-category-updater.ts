import type { InventoryCategory, UpdateInventoryCategory } from "@merchant/contracts";

import type { InventoryCategoryWriteAttempt } from "./inventory-category-writer.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryCategoryUpdateContext = InventoryCategoryWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Locks the scoped row and commits only rename, critical audit and original replay atomically. */
export interface InventoryCategoryUpdater {
  update(
    scope: InventoryMasterWriteScope,
    categoryId: string,
    input: UpdateInventoryCategory,
    attempt: InventoryCategoryWriteAttempt,
  ): Promise<InventoryCategory>;
}
export const INVENTORY_CATEGORY_UPDATER = Symbol("INVENTORY_CATEGORY_UPDATER");
