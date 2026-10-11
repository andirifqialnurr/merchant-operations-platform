import {
  catalogCategorySchema,
  catalogModifierGroupSchema,
  catalogModifierOptionSchema,
  catalogOutletProductSchema,
  catalogProductSchema,
  catalogProductImageSchema,
  catalogProductModifierGroupSchema,
  catalogProductVariantSchema,
  type CatalogCategory,
  type CatalogModifierGroup,
  type CatalogModifierOption,
  type CatalogOutletProduct,
  type CatalogProduct,
  type CatalogProductImage,
  type CatalogProductModifierGroup,
  type CatalogProductVariant,
} from "@merchant/contracts";
import {
  type CatalogCategoryRecord,
  type CatalogModifierGroupRecord,
  type CatalogModifierOptionRecord,
  type CatalogOutletProductRecord,
  type CatalogProductRecord,
  type CatalogProductImageRecord,
  type CatalogProductModifierGroupRecord,
  type CatalogProductVariantRecord,
} from "./catalog.repository.js";

/* Stored records to the shapes the API answers with. */

export function toCategory(record: CatalogCategoryRecord): CatalogCategory {
  return catalogCategorySchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toProduct(record: CatalogProductRecord): CatalogProduct {
  return catalogProductSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toProductVariant(record: CatalogProductVariantRecord): CatalogProductVariant {
  return catalogProductVariantSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toModifierGroup(record: CatalogModifierGroupRecord): CatalogModifierGroup {
  return catalogModifierGroupSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toModifierOption(record: CatalogModifierOptionRecord): CatalogModifierOption {
  return catalogModifierOptionSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toProductModifierGroup(
  record: CatalogProductModifierGroupRecord,
): CatalogProductModifierGroup {
  return catalogProductModifierGroupSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toProductImage(record: CatalogProductImageRecord): CatalogProductImage {
  return catalogProductImageSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toOutletProduct(record: CatalogOutletProductRecord): CatalogOutletProduct {
  return catalogOutletProductSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
