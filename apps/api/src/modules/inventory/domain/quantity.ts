import {
  INVENTORY_QUANTITY_INTEGER_DIGITS,
  inventoryConversionFactorSchema,
  inventoryQuantitySchema,
  inventoryUnitPrecisionSchema,
} from "@merchant/contracts";

export type InventoryQuantityProblem =
  | "INVENTORY_QUANTITY_INVALID"
  | "INVENTORY_UNIT_PRECISION_INVALID"
  | "INVENTORY_QUANTITY_PRECISION_EXCEEDED"
  | "INVENTORY_CONVERSION_FACTOR_INVALID"
  | "INVENTORY_CONVERSION_INEXACT"
  | "INVENTORY_QUANTITY_OUT_OF_RANGE";

export type InventoryQuantityResult<T> =
  { ok: true; value: T } | { ok: false; problem: InventoryQuantityProblem };
const failure = (problem: InventoryQuantityProblem) => ({ ok: false as const, problem });
const pow10 = (precision: number) => 10n ** BigInt(precision);
const absolute = (value: bigint) => (value < 0n ? -value : value);

/** Convert a decimal quantity to integer atoms of its unit. No rounding or locale coercion. */
export function parseInventoryQuantity(
  input: unknown,
  unitPrecision: unknown,
): InventoryQuantityResult<bigint> {
  const precision = inventoryUnitPrecisionSchema.safeParse(unitPrecision);
  if (!precision.success) return failure("INVENTORY_UNIT_PRECISION_INVALID");
  const quantity = inventoryQuantitySchema.safeParse(input);
  if (!quantity.success) return failure("INVENTORY_QUANTITY_INVALID");
  const negative = quantity.data.startsWith("-");
  const unsigned = negative ? quantity.data.slice(1) : quantity.data;
  const [whole, rawFraction = ""] = unsigned.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  if (fraction.length > precision.data) return failure("INVENTORY_QUANTITY_PRECISION_EXCEEDED");
  const atoms =
    BigInt(whole!) * pow10(precision.data) + BigInt(fraction.padEnd(precision.data, "0") || "0");
  return { ok: true, value: negative ? -atoms : atoms };
}

/** Canonical decimal suitable for numeric(30,6), independent of the display locale. */
export function formatInventoryQuantity(
  atoms: bigint,
  unitPrecision: unknown,
): InventoryQuantityResult<string> {
  const precision = inventoryUnitPrecisionSchema.safeParse(unitPrecision);
  if (!precision.success) return failure("INVENTORY_UNIT_PRECISION_INVALID");
  const magnitude = absolute(atoms);
  if (magnitude >= pow10(INVENTORY_QUANTITY_INTEGER_DIGITS + precision.data))
    return failure("INVENTORY_QUANTITY_OUT_OF_RANGE");
  const scale = pow10(precision.data);
  const whole = magnitude / scale;
  const fraction = (magnitude % scale).toString().padStart(precision.data, "0").replace(/0+$/, "");
  return { ok: true, value: `${atoms < 0n ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}` };
}

/**
 * Apply a supplied, authorized direct conversion factor. This does not resolve
 * unit ownership, physical dimensions, reciprocal factors, or negative-stock policy.
 */
export function convertInventoryQuantity(input: {
  quantity: unknown;
  fromPrecision: unknown;
  toPrecision: unknown;
  factor: unknown;
}): InventoryQuantityResult<string> {
  const sourcePrecision = inventoryUnitPrecisionSchema.safeParse(input.fromPrecision);
  if (!sourcePrecision.success) return failure("INVENTORY_UNIT_PRECISION_INVALID");
  const source = parseInventoryQuantity(input.quantity, sourcePrecision.data);
  if (!source.ok) return source;
  const target = inventoryUnitPrecisionSchema.safeParse(input.toPrecision);
  if (!target.success) return failure("INVENTORY_UNIT_PRECISION_INVALID");
  const factor = inventoryConversionFactorSchema.safeParse(input.factor);
  if (!factor.success) return failure("INVENTORY_CONVERSION_FACTOR_INVALID");
  const [whole, fraction = ""] = factor.data.split(".");
  const coefficient = BigInt(whole!) * pow10(fraction.length) + BigInt(fraction || "0");
  const numerator = source.value * coefficient * pow10(target.data);
  const denominator = pow10(sourcePrecision.data) * pow10(fraction.length);
  if (numerator % denominator !== 0n) return failure("INVENTORY_CONVERSION_INEXACT");
  return formatInventoryQuantity(numerator / denominator, target.data);
}
