import type { InventoryUnit, UpdateInventoryUnit } from "@merchant/contracts";

import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";
import type { InventoryUnitWriteAttempt } from "./inventory-unit-writer.js";

export type InventoryUnitUpdateContext = InventoryUnitWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Locks the scoped definition and commits patch, critical audit and original replay atomically. */
export interface InventoryUnitUpdater {
  update(
    scope: InventoryMasterWriteScope,
    unitId: string,
    patch: UpdateInventoryUnit,
    attempt: InventoryUnitWriteAttempt,
  ): Promise<InventoryUnit>;
}
export const INVENTORY_UNIT_UPDATER = Symbol("INVENTORY_UNIT_UPDATER");
