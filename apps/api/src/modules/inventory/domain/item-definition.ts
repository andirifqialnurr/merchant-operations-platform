import type { CreateInventoryItem } from "@merchant/contracts";

import { formatInventoryQuantity, parseInventoryQuantity } from "./quantity.js";

/** Input is syntax-validated first. Parent precision is checked under its row lock later. */
export function normalizeInventoryItem(input: CreateInventoryItem): CreateInventoryItem {
  let minStock = input.minStock;
  if (minStock !== null) {
    const parsed = parseInventoryQuantity(minStock, 6);
    if (!parsed.ok) throw new Error("Invalid Inventory minimum.");
    const formatted = formatInventoryQuantity(parsed.value, 6);
    if (!formatted.ok) throw new Error("Invalid Inventory minimum.");
    minStock = formatted.value;
  }
  return {
    name: input.name,
    sku: input.sku,
    categoryId: input.categoryId?.toLowerCase() ?? null,
    baseUnitId: input.baseUnitId.toLowerCase(),
    minStock,
  };
}
