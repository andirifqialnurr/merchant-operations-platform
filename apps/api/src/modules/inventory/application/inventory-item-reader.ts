import type { InventoryItem, InventoryItemListQuery } from "@merchant/contracts";

import type { InventoryMasterScope } from "./inventory-master-reader.js";

/** Shared master definitions only, ordered by immutable ID, at most limit + 1. */
export interface InventoryItemReader {
  listItems(scope: InventoryMasterScope, query: InventoryItemListQuery): Promise<InventoryItem[]>;
}
export const INVENTORY_ITEM_READER = Symbol("INVENTORY_ITEM_READER");
