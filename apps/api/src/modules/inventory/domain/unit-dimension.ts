import { inventoryUnitDimensionSchema } from "@merchant/contracts";

/** A necessary condition only: does not prove ownership, factor accuracy or precision. */
export function haveCompatibleInventoryUnitDimensions(from: unknown, to: unknown): boolean {
  const source = inventoryUnitDimensionSchema.safeParse(from);
  const target = inventoryUnitDimensionSchema.safeParse(to);
  return source.success && target.success && source.data === target.data;
}
