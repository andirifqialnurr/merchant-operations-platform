import type { InventoryCategory, InventoryCategoryListQuery } from "@merchant/contracts";

import type { InventoryMasterScope } from "./inventory-master-reader.js";

/** Read-only Inventory-owned definitions, at most limit + 1 rows ordered by immutable ID. */
export interface InventoryCategoryReader {
  listCategories(
    scope: InventoryMasterScope,
    query: InventoryCategoryListQuery,
  ): Promise<InventoryCategory[]>;
}
export const INVENTORY_CATEGORY_READER = Symbol("INVENTORY_CATEGORY_READER");
