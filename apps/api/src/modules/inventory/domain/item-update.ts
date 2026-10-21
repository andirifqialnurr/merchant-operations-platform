import type { InventoryItem, UpdateInventoryItem } from "@merchant/contracts";

import { normalizeInventoryMinimum } from "./item-definition.js";
import { parseInventoryQuantity } from "./quantity.js";

/** Stable field order for the logical hash; never add defaults to a partial patch. */
export function normalizeInventoryItemPatch(input: UpdateInventoryItem): UpdateInventoryItem {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.sku !== undefined ? { sku: input.sku } : {}),
    ...(input.categoryId !== undefined
      ? { categoryId: input.categoryId?.toLowerCase() ?? null }
      : {}),
    ...(input.minStock !== undefined
      ? { minStock: normalizeInventoryMinimum(input.minStock) }
      : {}),
  };
}

/** Only editable metadata/threshold fields; status and quantity meaning are preserved. */
export function planInventoryItemUpdate(
  before: InventoryItem,
  patch: UpdateInventoryItem,
  precision: number,
) {
  const after = {
    ...before,
    name: patch.name ?? before.name,
    sku: patch.sku !== undefined ? patch.sku : before.sku,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : before.categoryId,
    minStock: patch.minStock !== undefined ? patch.minStock : before.minStock,
  };
  if (after.minStock !== null && !parseInventoryQuantity(after.minStock, precision).ok)
    return { ok: false as const, code: "INVENTORY_MINIMUM_PRECISION_EXCEEDED" as const };
  const flags = {
    nameChanged: after.name !== before.name,
    skuChanged: after.sku !== before.sku,
    minStockChanged: after.minStock !== before.minStock,
  };
  const categoryChanged = after.categoryId !== before.categoryId;
  return {
    ok: true as const,
    after,
    flags,
    categoryChanged,
    changed: categoryChanged || Object.values(flags).some(Boolean),
  };
}
