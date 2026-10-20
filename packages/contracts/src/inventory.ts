import * as z from "zod";

/** R1 storage bounds, not package/usage limits. Amounts never travel as JSON numbers. */
export const INVENTORY_QUANTITY_SCALE = 6;
export const INVENTORY_QUANTITY_INTEGER_DIGITS = 24;
export const INVENTORY_FACTOR_SCALE = 12;
export const INVENTORY_FACTOR_INTEGER_DIGITS = 18;

export const inventoryUnitPrecisionSchema = z.number().int().min(0).max(INVENTORY_QUANTITY_SCALE);

/** Signed decimal for ledger/projection. Per-unit precision is checked by the domain. */
export const inventoryQuantitySchema = z
  .string()
  .max(32)
  .regex(/^-?(?:0|[1-9]\d{0,23})(?:\.\d{1,6})?$/);
export const inventoryNonnegativeQuantitySchema = inventoryQuantitySchema.refine(
  (value) => !value.startsWith("-"),
  { message: "Quantity must be nonnegative." },
);
export const inventoryPositiveQuantitySchema = inventoryNonnegativeQuantitySchema.refine(
  (value) => /[1-9]/.test(value),
  { message: "Quantity must be positive." },
);

/** numeric(30,12); conversion is exact or rejected, never silently rounded. */
export const inventoryConversionFactorSchema = z
  .string()
  .max(31)
  .regex(/^(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/)
  .refine((value) => /[1-9]/.test(value), { message: "Conversion factor must be positive." });

export const createInventoryUnitSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[A-Za-z][A-Za-z0-9._-]*$/),
    name: z.string().trim().min(1).max(160),
    precision: inventoryUnitPrecisionSchema,
  })
  .strict();

export const inventoryUnitSchema = createInventoryUnitSchema.extend({ id: z.uuid() }).strict();

/** Scope, unit compatibility and ownership must still be proven by a future use case. */
export const createInventoryUnitConversionSchema = z
  .object({
    fromUnitId: z.uuid(),
    toUnitId: z.uuid(),
    factor: inventoryConversionFactorSchema,
  })
  .strict()
  .refine((value) => value.fromUnitId.toLowerCase() !== value.toUnitId.toLowerCase(), {
    message: "Conversion must connect different units.",
    path: ["toUnitId"],
  });

export type CreateInventoryUnit = z.infer<typeof createInventoryUnitSchema>;
export type InventoryUnit = z.infer<typeof inventoryUnitSchema>;
export type CreateInventoryUnitConversion = z.infer<typeof createInventoryUnitConversionSchema>;
export type InventoryQuantity = z.infer<typeof inventoryQuantitySchema>;
