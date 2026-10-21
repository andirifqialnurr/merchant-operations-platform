import type { InventoryUnitConversion, UpdateInventoryUnitConversion } from "@merchant/contracts";

import type { InventoryConversionWriteAttempt } from "./inventory-conversion-writer.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryConversionUpdateContext = InventoryConversionWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Locks compatible parents and the scoped immutable pair; commits factor/audit/replay atomically. */
export interface InventoryConversionUpdater {
  update(
    scope: InventoryMasterWriteScope,
    conversionId: string,
    patch: UpdateInventoryUnitConversion,
    attempt: InventoryConversionWriteAttempt,
  ): Promise<InventoryUnitConversion>;
}
export const INVENTORY_CONVERSION_UPDATER = Symbol("INVENTORY_CONVERSION_UPDATER");
