import type { InventoryItem, UpdateInventoryItem } from "@merchant/contracts";

import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";
import type { InventoryItemWriteAttempt } from "./inventory-item-writer.js";

export type InventoryItemUpdateContext = InventoryItemWriteAttempt & {
  identity: InventoryWriteIdentity;
};
/** Narrow partial metadata edit; status/base unit immutable here, original no-op result reserved. */
export interface InventoryItemUpdater {
  update(
    scope: InventoryMasterWriteScope,
    itemId: string,
    patch: UpdateInventoryItem,
    attempt: InventoryItemWriteAttempt,
  ): Promise<InventoryItem>;
}
export const INVENTORY_ITEM_UPDATER = Symbol("INVENTORY_ITEM_UPDATER");
