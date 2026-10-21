import type { CreateInventoryUnitConversion } from "@merchant/contracts";

/** Validated factor string only. No arithmetic, exponent conversion or rounding. */
export function normalizeInventoryConversionFactor(factor: string): string {
  return factor.includes(".") ? factor.replace(/0+$/, "").replace(/\.$/, "") : factor;
}

/** Input is already validated by the shared contract. Never uses decimal arithmetic. */
export function normalizeInventoryUnitConversion(
  input: CreateInventoryUnitConversion,
): CreateInventoryUnitConversion {
  return {
    fromUnitId: input.fromUnitId.toLowerCase(),
    toUnitId: input.toUnitId.toLowerCase(),
    factor: normalizeInventoryConversionFactor(input.factor),
  };
}
