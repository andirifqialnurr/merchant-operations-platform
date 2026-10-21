import type { CreateInventoryItem } from "@merchant/contracts";

import { formatInventoryQuantity, parseInventoryQuantity } from "./quantity.js";

/** Input is syntax-validated first. Parent precision is checked under its row lock later. */
export function normalizeInventoryMinimum(input: string | null): string | null {
  if (input === null) return null;
  const parsed = parseInventoryQuantity(input, 6);
  if (!parsed.ok) throw new Error("Invalid Inventory minimum.");
  const formatted = formatInventoryQuantity(parsed.value, 6);
  if (!formatted.ok) throw new Error("Invalid Inventory minimum.");
  return formatted.value;
}

export function normalizeInventoryItem(input: CreateInventoryItem): CreateInventoryItem {
  return {
    name: input.name,
    sku: input.sku,
    categoryId: input.categoryId?.toLowerCase() ?? null,
    baseUnitId: input.baseUnitId.toLowerCase(),
    minStock: normalizeInventoryMinimum(input.minStock),
  };
}
