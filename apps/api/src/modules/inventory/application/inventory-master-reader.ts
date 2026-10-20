import type {
  InventoryUnit,
  InventoryUnitConversion,
  InventoryUnitConversionListQuery,
  InventoryUnitListQuery,
} from "@merchant/contracts";

export type InventoryMasterScope = Readonly<{ tenantId: string }>;

/** Internal port; callers use the authorized queries, never expose this adapter directly.
 * Returns at most limit + 1 rows, sorted by immutable id, for keyset pagination.
 */
export interface InventoryMasterReader {
  listUnits(scope: InventoryMasterScope, query: InventoryUnitListQuery): Promise<InventoryUnit[]>;
  listConversions(
    scope: InventoryMasterScope,
    query: InventoryUnitConversionListQuery,
  ): Promise<InventoryUnitConversion[]>;
}

export const INVENTORY_MASTER_READER = Symbol("INVENTORY_MASTER_READER");
