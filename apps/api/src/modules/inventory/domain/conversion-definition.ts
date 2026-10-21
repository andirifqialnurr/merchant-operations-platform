import type { CreateInventoryUnitConversion } from "@merchant/contracts";

/** Input is already validated by the shared contract. Never uses decimal arithmetic. */
export function normalizeInventoryUnitConversion(
  input: CreateInventoryUnitConversion,
): CreateInventoryUnitConversion {
  const factor = input.factor.includes(".")
    ? input.factor.replace(/0+$/, "").replace(/\.$/, "")
    : input.factor;
  return {
    fromUnitId: input.fromUnitId.toLowerCase(),
    toUnitId: input.toUnitId.toLowerCase(),
    factor,
  };
}
