import * as z from "zod";

import { organizationRecordTimestampsSchema } from "./internal.ts";
import { displayOrderSchema } from "./http.ts";
import { currencyCodeSchema, moneyMinorSchema } from "./money.ts";
import { organizationSlugSchema, organizationUnitStatusSchema } from "./organization.ts";

export const catalogRecordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const productAvailabilitySchema = z.enum(["AVAILABLE", "SOLD_OUT"]);

export const catalogNameSchema = z.string().trim().min(2).max(160);

export const catalogSlugSchema = organizationSlugSchema;

export const catalogCategorySchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  displayOrder: displayOrderSchema,
  status: catalogRecordStatusSchema,
});

export const catalogProductSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  categoryId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  description: z.string().trim().min(1).max(2_000).nullable(),
  basePriceMinor: moneyMinorSchema,
  currency: currencyCodeSchema,
  availability: productAvailabilitySchema,
  status: catalogRecordStatusSchema,
});

export const createCatalogCategorySchema = z.object({
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  displayOrder: displayOrderSchema.default(0),
});

export const updateCatalogCategorySchema = z
  .object({
    name: catalogNameSchema.optional(),
    slug: catalogSlugSchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan kategori wajib diisi.",
  });

export const createCatalogProductSchema = z.object({
  categoryId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  description: z.string().trim().min(1).max(2_000).nullable().optional(),
  basePriceMinor: moneyMinorSchema,
  currency: currencyCodeSchema.default("IDR"),
  availability: productAvailabilitySchema.default("AVAILABLE"),
});

export const updateCatalogProductSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: catalogNameSchema.optional(),
    slug: catalogSlugSchema.optional(),
    description: z.string().trim().min(1).max(2_000).nullable().optional(),
    basePriceMinor: moneyMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    availability: productAvailabilitySchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan produk wajib diisi.",
  });

export const modifierSelectionTypeSchema = z.enum(["SINGLE", "MULTIPLE"]);

export const selectionCountSchema = z.number().int().min(0).max(100);

export const productImageObjectKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(512)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .refine((value) => !value.split("/").includes(".."), {
    message: "Object key tidak boleh memuat path traversal.",
  });

export const productImageContentTypeSchema = z.enum([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const productImageDimensionSchema = z.number().int().min(1).max(100_000);

const modifierSelectionRuleSchema = z
  .object({
    maxSelections: selectionCountSchema,
    minSelections: selectionCountSchema,
    selectionType: modifierSelectionTypeSchema,
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
  })
  .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
    message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
  });

export const catalogProductVariantSchema = organizationRecordTimestampsSchema.extend({
  availability: productAvailabilitySchema,
  displayOrder: displayOrderSchema,
  id: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogProductVariantSchema = z.object({
  availability: productAvailabilitySchema.default("AVAILABLE"),
  displayOrder: displayOrderSchema.default(0),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema.default("0"),
  productId: z.uuid(),
});

export const updateCatalogProductVariantSchema = z
  .object({
    availability: productAvailabilitySchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    name: catalogNameSchema.optional(),
    priceDeltaMinor: moneyMinorSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan variant wajib diisi.",
  });

export const catalogModifierGroupSchema = organizationRecordTimestampsSchema
  .extend({
    displayOrder: displayOrderSchema,
    id: z.uuid(),
    name: catalogNameSchema,
    ...modifierSelectionRuleSchema.shape,
    status: catalogRecordStatusSchema,
    tenantId: z.uuid(),
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
  })
  .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
    message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
  });

export const createCatalogModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.default(0),
    name: catalogNameSchema,
    maxSelections: selectionCountSchema.default(1),
    minSelections: selectionCountSchema.default(0),
    selectionType: modifierSelectionTypeSchema.default("SINGLE"),
  })
  .pipe(
    z
      .object({
        displayOrder: displayOrderSchema,
        name: catalogNameSchema,
        ...modifierSelectionRuleSchema.shape,
      })
      .refine((value) => value.minSelections <= value.maxSelections, {
        message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
      })
      .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
        message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
      }),
  );

export const updateCatalogModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.optional(),
    maxSelections: selectionCountSchema.optional(),
    minSelections: selectionCountSchema.optional(),
    name: catalogNameSchema.optional(),
    selectionType: modifierSelectionTypeSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan modifier group wajib diisi.",
  });

export const catalogModifierOptionSchema = organizationRecordTimestampsSchema.extend({
  availability: productAvailabilitySchema,
  displayOrder: displayOrderSchema,
  groupId: z.uuid(),
  id: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogModifierOptionSchema = z.object({
  availability: productAvailabilitySchema.default("AVAILABLE"),
  displayOrder: displayOrderSchema.default(0),
  groupId: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema.default("0"),
});

export const updateCatalogModifierOptionSchema = z
  .object({
    availability: productAvailabilitySchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    name: catalogNameSchema.optional(),
    priceDeltaMinor: moneyMinorSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan modifier option wajib diisi.",
  });

export const catalogProductModifierGroupSchema = organizationRecordTimestampsSchema.extend({
  displayOrder: displayOrderSchema,
  id: z.uuid(),
  modifierGroupId: z.uuid(),
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogProductModifierGroupSchema = z.object({
  displayOrder: displayOrderSchema.default(0),
  modifierGroupId: z.uuid(),
  productId: z.uuid(),
});

export const updateCatalogProductModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan assignment modifier wajib diisi.",
  });

export const catalogProductImageSchema = organizationRecordTimestampsSchema.extend({
  altText: z.string().trim().min(1).max(300).nullable(),
  contentType: productImageContentTypeSchema,
  displayOrder: displayOrderSchema,
  height: productImageDimensionSchema.nullable(),
  id: z.uuid(),
  isPrimary: z.boolean(),
  objectKey: productImageObjectKeySchema,
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
  width: productImageDimensionSchema.nullable(),
});

export const createCatalogProductImageSchema = z.object({
  altText: z.string().trim().min(1).max(300).nullable().optional(),
  contentType: productImageContentTypeSchema,
  displayOrder: displayOrderSchema.default(0),
  height: productImageDimensionSchema.nullable().optional(),
  isPrimary: z.boolean().default(false),
  objectKey: productImageObjectKeySchema,
  productId: z.uuid(),
  width: productImageDimensionSchema.nullable().optional(),
});

export const updateCatalogProductImageSchema = z
  .object({
    altText: z.string().trim().min(1).max(300).nullable().optional(),
    displayOrder: displayOrderSchema.optional(),
    height: productImageDimensionSchema.nullable().optional(),
    isPrimary: z.boolean().optional(),
    status: catalogRecordStatusSchema.optional(),
    width: productImageDimensionSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan product image wajib diisi.",
  });

export const catalogOutletProductSchema = organizationRecordTimestampsSchema.extend({
  availabilityOverride: productAvailabilitySchema.nullable(),
  displayOrder: displayOrderSchema,
  id: z.uuid(),
  outletId: z.uuid(),
  priceOverrideMinor: moneyMinorSchema.nullable(),
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogOutletProductSchema = z.object({
  availabilityOverride: productAvailabilitySchema.nullable().default(null),
  displayOrder: displayOrderSchema.default(0),
  outletId: z.uuid(),
  priceOverrideMinor: moneyMinorSchema.nullable().default(null),
  productId: z.uuid(),
});

export const createCatalogOutletProductForOutletSchema = createCatalogOutletProductSchema.omit({
  outletId: true,
});

export const catalogOutletParamsSchema = z.object({ outletId: z.uuid() });

export const catalogOutletProductParamsSchema = catalogOutletParamsSchema.extend({ id: z.uuid() });

export const updateCatalogOutletProductSchema = z
  .object({
    availabilityOverride: productAvailabilitySchema.nullable().optional(),
    displayOrder: displayOrderSchema.optional(),
    priceOverrideMinor: moneyMinorSchema.nullable().optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan outlet product wajib diisi.",
  });

export const catalogOutletProductItemSchema = z.object({
  assignment: catalogOutletProductSchema,
  effectiveAvailability: productAvailabilitySchema,
  effectivePriceMinor: moneyMinorSchema,
  inheritsAvailability: z.boolean(),
  inheritsPrice: z.boolean(),
  product: catalogProductSchema,
  sellable: z.boolean(),
});

export const catalogOutletSnapshotSchema = z.object({
  items: z.array(catalogOutletProductItemSchema),
  outletId: z.uuid(),
  outletStatus: organizationUnitStatusSchema,
  tenantId: z.uuid(),
});

export const catalogSnapshotSchema = z.object({
  categories: z.array(catalogCategorySchema),
  modifierGroups: z.array(catalogModifierGroupSchema),
  modifierOptions: z.array(catalogModifierOptionSchema),
  outletProducts: z.array(catalogOutletProductSchema),
  productImages: z.array(catalogProductImageSchema),
  productModifierGroups: z.array(catalogProductModifierGroupSchema),
  productVariants: z.array(catalogProductVariantSchema),
  products: z.array(catalogProductSchema),
});

export type CatalogCategory = z.infer<typeof catalogCategorySchema>;

export type CatalogModifierGroup = z.infer<typeof catalogModifierGroupSchema>;

export type CatalogModifierOption = z.infer<typeof catalogModifierOptionSchema>;

export type CatalogOutletProduct = z.infer<typeof catalogOutletProductSchema>;

export type CatalogOutletProductItem = z.infer<typeof catalogOutletProductItemSchema>;

export type CatalogOutletParams = z.infer<typeof catalogOutletParamsSchema>;

export type CatalogOutletProductParams = z.infer<typeof catalogOutletProductParamsSchema>;

export type CatalogOutletSnapshot = z.infer<typeof catalogOutletSnapshotSchema>;

export type CatalogProduct = z.infer<typeof catalogProductSchema>;

export type CatalogProductImage = z.infer<typeof catalogProductImageSchema>;

export type CatalogProductModifierGroup = z.infer<typeof catalogProductModifierGroupSchema>;

export type CatalogProductVariant = z.infer<typeof catalogProductVariantSchema>;

export type CatalogRecordStatus = z.infer<typeof catalogRecordStatusSchema>;

export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;

export type CreateCatalogCategory = z.infer<typeof createCatalogCategorySchema>;

export type CreateCatalogModifierGroup = z.infer<typeof createCatalogModifierGroupSchema>;

export type CreateCatalogModifierOption = z.infer<typeof createCatalogModifierOptionSchema>;

export type CreateCatalogOutletProduct = z.infer<typeof createCatalogOutletProductSchema>;

export type CreateCatalogOutletProductForOutlet = z.infer<
  typeof createCatalogOutletProductForOutletSchema
>;

export type CreateCatalogProduct = z.infer<typeof createCatalogProductSchema>;

export type CreateCatalogProductImage = z.infer<typeof createCatalogProductImageSchema>;

export type CreateCatalogProductModifierGroup = z.infer<
  typeof createCatalogProductModifierGroupSchema
>;

export type CreateCatalogProductVariant = z.infer<typeof createCatalogProductVariantSchema>;

export type ModifierSelectionType = z.infer<typeof modifierSelectionTypeSchema>;

export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

export type UpdateCatalogCategory = z.infer<typeof updateCatalogCategorySchema>;

export type UpdateCatalogModifierGroup = z.infer<typeof updateCatalogModifierGroupSchema>;

export type UpdateCatalogModifierOption = z.infer<typeof updateCatalogModifierOptionSchema>;

export type UpdateCatalogOutletProduct = z.infer<typeof updateCatalogOutletProductSchema>;

export type UpdateCatalogProduct = z.infer<typeof updateCatalogProductSchema>;

export type UpdateCatalogProductImage = z.infer<typeof updateCatalogProductImageSchema>;

export type UpdateCatalogProductModifierGroup = z.infer<
  typeof updateCatalogProductModifierGroupSchema
>;

export type UpdateCatalogProductVariant = z.infer<typeof updateCatalogProductVariantSchema>;
