import * as z from "zod";

import { createCursorPageSchema, cursorPaginationQuerySchema } from "./http.ts";

/** R1 storage bounds, not package/usage limits. Amounts never travel as JSON numbers. */
export const INVENTORY_QUANTITY_SCALE = 6;
export const INVENTORY_QUANTITY_INTEGER_DIGITS = 24;
export const INVENTORY_FACTOR_SCALE = 12;
export const INVENTORY_FACTOR_INTEGER_DIGITS = 18;

export const inventoryUnitPrecisionSchema = z.number().int().min(0).max(INVENTORY_QUANTITY_SCALE);

/** Explicit physical classification, never inferred from a unit's code or label. */
export const inventoryUnitDimensionSchema = z.enum(["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"]);

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
    dimension: inventoryUnitDimensionSchema,
  })
  .strict();

/** Partial edit only; known dimensions and reference metadata are never client mutations. */
export const updateInventoryUnitSchema = createInventoryUnitSchema
  .pick({ code: true, name: true, precision: true })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one unit field is required.",
  });

/** NULL is an unclassified legacy definition, never a compatible fallback dimension. */
export const inventoryUnitSchema = createInventoryUnitSchema
  .extend({ id: z.uuid(), dimension: inventoryUnitDimensionSchema.nullable() })
  .strict();

/** Syntax only: scope, ownership and compatibility require the command's stable parent checks. */
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

/** Pair/identity are immutable; only the explicit factor belongs to this edit. */
export const updateInventoryUnitConversionSchema = z
  .object({ factor: inventoryConversionFactorSchema })
  .strict();

/** Authoritative definition only, not a calculated quantity or proof of compatibility. */
export const inventoryUnitConversionSchema = createInventoryUnitConversionSchema
  .safeExtend({ id: z.uuid() })
  .strict();

export const inventoryUnitListQuerySchema = cursorPaginationQuerySchema
  .extend({
    cursor: z.uuid().optional(),
    limit: z
      .union([z.number(), z.string().regex(/^[1-9]\d{0,2}$/)])
      .pipe(z.coerce.number<string | number>().int().min(1).max(100))
      .default(25),
  })
  .strict();
export const inventoryUnitConversionListQuerySchema = inventoryUnitListQuerySchema
  .extend({ fromUnitId: z.uuid().optional(), toUnitId: z.uuid().optional() })
  .strict();

/** Inventory-owned master state; reading a status does not authorize lifecycle mutations. */
export const inventoryRecordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const inventoryCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(160),
    status: inventoryRecordStatusSchema,
  })
  .strict();
/** Create owns only the name; initial status and identity are server decisions. */
export const createInventoryCategorySchema = inventoryCategorySchema.pick({ name: true }).strict();
/** Rename owns the same single field; lifecycle is a separate command. */
export const updateInventoryCategorySchema = createInventoryCategorySchema;
/** Dedicated lifecycle workflow; create and rename do not own this field. */
export const setInventoryCategoryStatusSchema = z
  .object({ status: inventoryRecordStatusSchema })
  .strict();
export const inventoryCategoryListQuerySchema = inventoryUnitListQuerySchema
  .extend({ status: inventoryRecordStatusSchema.optional() })
  .strict();

/** Master definition only: NULL threshold is unavailable, never an invented zero balance. */
export const inventoryItemSchema = z
  .object({
    id: z.uuid(),
    sku: z.string().trim().min(1).max(64).nullable(),
    name: z.string().trim().min(1).max(160),
    categoryId: z.uuid().nullable(),
    baseUnitId: z.uuid(),
    minStock: inventoryNonnegativeQuantitySchema.nullable(),
    status: inventoryRecordStatusSchema,
  })
  .strict();
/** Status/identity are server-owned; minimum is a threshold, not opening stock. */
export const createInventoryItemSchema = inventoryItemSchema
  .pick({ name: true, sku: true, categoryId: true, baseUnitId: true, minStock: true })
  .extend({
    sku: inventoryItemSchema.shape.sku.optional().default(null),
    categoryId: inventoryItemSchema.shape.categoryId.optional().default(null),
    minStock: inventoryItemSchema.shape.minStock.optional().default(null),
  })
  .strict();
/** Partial edit without create defaults: omission preserves, NULL explicitly clears. */
export const updateInventoryItemSchema = inventoryItemSchema
  .pick({ name: true, sku: true, categoryId: true, minStock: true })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one item field is required.",
  });
export const inventoryItemListQuerySchema = inventoryCategoryListQuerySchema
  .extend({ categoryId: z.uuid().optional(), baseUnitId: z.uuid().optional() })
  .strict();

const inventoryMasterPageInfoSchema = z
  .object({ hasNextPage: z.boolean(), nextCursor: z.uuid().nullable() })
  .strict()
  .refine((value) => value.hasNextPage === (value.nextCursor !== null));

function endCursorMatches(page: {
  items: Array<{ id: string }>;
  pageInfo: { hasNextPage: boolean; nextCursor: string | null };
}) {
  return !page.pageInfo.hasNextPage || page.items.at(-1)?.id === page.pageInfo.nextCursor;
}

export const inventoryUnitPageSchema = createCursorPageSchema(inventoryUnitSchema)
  .extend({ items: z.array(inventoryUnitSchema).max(100), pageInfo: inventoryMasterPageInfoSchema })
  .strict()
  .refine(endCursorMatches);
export const inventoryUnitConversionPageSchema = createCursorPageSchema(
  inventoryUnitConversionSchema,
)
  .extend({
    items: z.array(inventoryUnitConversionSchema).max(100),
    pageInfo: inventoryMasterPageInfoSchema,
  })
  .strict()
  .refine(endCursorMatches);

export const inventoryCategoryPageSchema = createCursorPageSchema(inventoryCategorySchema)
  .extend({
    items: z.array(inventoryCategorySchema).max(100),
    pageInfo: inventoryMasterPageInfoSchema,
  })
  .strict()
  .refine(endCursorMatches);

export const inventoryItemPageSchema = createCursorPageSchema(inventoryItemSchema)
  .extend({ items: z.array(inventoryItemSchema).max(100), pageInfo: inventoryMasterPageInfoSchema })
  .strict()
  .refine(endCursorMatches);

export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type CreateInventoryItem = z.infer<typeof createInventoryItemSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryItemListQuery = z.infer<typeof inventoryItemListQuerySchema>;
export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
export type CreateInventoryCategory = z.infer<typeof createInventoryCategorySchema>;
export type UpdateInventoryCategory = z.infer<typeof updateInventoryCategorySchema>;
export type SetInventoryCategoryStatus = z.infer<typeof setInventoryCategoryStatusSchema>;
export type InventoryCategoryListQuery = z.infer<typeof inventoryCategoryListQuerySchema>;
export type InventoryUnitConversion = z.infer<typeof inventoryUnitConversionSchema>;
export type InventoryUnitListQuery = z.infer<typeof inventoryUnitListQuerySchema>;
export type InventoryUnitConversionListQuery = z.infer<
  typeof inventoryUnitConversionListQuerySchema
>;
export type CreateInventoryUnit = z.infer<typeof createInventoryUnitSchema>;
export type UpdateInventoryUnit = z.infer<typeof updateInventoryUnitSchema>;
export type InventoryUnit = z.infer<typeof inventoryUnitSchema>;
export type InventoryUnitDimension = z.infer<typeof inventoryUnitDimensionSchema>;
export type CreateInventoryUnitConversion = z.infer<typeof createInventoryUnitConversionSchema>;
export type UpdateInventoryUnitConversion = z.infer<typeof updateInventoryUnitConversionSchema>;
export type InventoryQuantity = z.infer<typeof inventoryQuantitySchema>;
