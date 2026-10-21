import type { InventoryCategory, SetInventoryCategoryStatus } from "@merchant/contracts";

import type { InventoryCategoryWriteAttempt } from "./inventory-category-writer.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryCategoryStatusContext = InventoryCategoryWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Changes only category status; never cascades to items or rewrites history. */
export interface InventoryCategoryStatusWriter {
  setStatus(
    scope: InventoryMasterWriteScope,
    categoryId: string,
    input: SetInventoryCategoryStatus,
    attempt: InventoryCategoryWriteAttempt,
  ): Promise<InventoryCategory>;
}
export const INVENTORY_CATEGORY_STATUS_WRITER = Symbol("INVENTORY_CATEGORY_STATUS_WRITER");
