import type {
  CreateCatalogOutletProduct,
  CreateCatalogModifierGroup,
  CreateCatalogModifierOption,
  CreateCatalogCategory,
  CreateCatalogProduct,
  CreateCatalogProductImage,
  CreateCatalogProductModifierGroup,
  CreateCatalogProductVariant,
  UpdateCatalogModifierGroup,
  UpdateCatalogModifierOption,
  UpdateCatalogOutletProduct,
  UpdateCatalogCategory,
  UpdateCatalogProduct,
  UpdateCatalogProductImage,
  UpdateCatalogProductModifierGroup,
  UpdateCatalogProductVariant,
} from "@merchant/contracts";
import type {
  CatalogMutationContext,
  CatalogTenantRecord,
  CatalogOutletRecord,
  CatalogCategoryRecord,
  CatalogProductRecord,
  CatalogProductVariantRecord,
  CatalogModifierGroupRecord,
  CatalogModifierOptionRecord,
  CatalogProductModifierGroupRecord,
  CatalogProductImageRecord,
  CatalogOutletProductRecord,
  CatalogSnapshotRecord,
} from "../domain/catalog-records.js";

// The records are part of the port: whoever holds the repository reads them.
export type * from "../domain/catalog-records.js";

/** Persistence port of the catalog. Every method is scoped to one workspace. */

export interface CatalogRepository {
  createCategory(
    tenantId: string,
    input: CreateCatalogCategory,
    context?: CatalogMutationContext,
  ): Promise<CatalogCategoryRecord>;
  createProduct(
    tenantId: string,
    input: CreateCatalogProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductRecord>;
  createProductVariant(
    tenantId: string,
    input: CreateCatalogProductVariant,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductVariantRecord>;
  createModifierGroup(
    tenantId: string,
    input: CreateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierGroupRecord>;
  createModifierOption(
    tenantId: string,
    input: CreateCatalogModifierOption,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierOptionRecord>;
  createProductModifierGroup(
    tenantId: string,
    input: CreateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductModifierGroupRecord>;
  createProductImage(
    tenantId: string,
    input: CreateCatalogProductImage,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductImageRecord>;
  createOutletProduct(
    tenantId: string,
    input: CreateCatalogOutletProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogOutletProductRecord>;
  findCategoryById(tenantId: string, categoryId: string): Promise<CatalogCategoryRecord | null>;
  findCategoryBySlug(tenantId: string, slug: string): Promise<CatalogCategoryRecord | null>;
  findProductById(tenantId: string, productId: string): Promise<CatalogProductRecord | null>;
  findProductBySlug(tenantId: string, slug: string): Promise<CatalogProductRecord | null>;
  findProductVariantById(
    tenantId: string,
    variantId: string,
  ): Promise<CatalogProductVariantRecord | null>;
  findModifierGroupById(
    tenantId: string,
    groupId: string,
  ): Promise<CatalogModifierGroupRecord | null>;
  findModifierGroupByName(
    tenantId: string,
    name: string,
  ): Promise<CatalogModifierGroupRecord | null>;
  findModifierOptionById(
    tenantId: string,
    optionId: string,
  ): Promise<CatalogModifierOptionRecord | null>;
  findModifierOptionByName(
    tenantId: string,
    groupId: string,
    name: string,
  ): Promise<CatalogModifierOptionRecord | null>;
  findProductModifierGroupById(
    tenantId: string,
    assignmentId: string,
  ): Promise<CatalogProductModifierGroupRecord | null>;
  findProductModifierGroup(
    tenantId: string,
    productId: string,
    modifierGroupId: string,
  ): Promise<CatalogProductModifierGroupRecord | null>;
  findProductImageById(
    tenantId: string,
    imageId: string,
  ): Promise<CatalogProductImageRecord | null>;
  findProductImageByObjectKey(
    tenantId: string,
    objectKey: string,
  ): Promise<CatalogProductImageRecord | null>;
  findOutlet(tenantId: string, outletId: string): Promise<CatalogOutletRecord | null>;
  findOutletProductById(
    tenantId: string,
    outletProductId: string,
  ): Promise<CatalogOutletProductRecord | null>;
  findOutletProduct(
    tenantId: string,
    outletId: string,
    productId: string,
  ): Promise<CatalogOutletProductRecord | null>;
  findTenant(tenantId: string): Promise<CatalogTenantRecord | null>;
  getSnapshot(tenantId: string): Promise<CatalogSnapshotRecord | null>;
  updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateCatalogCategory,
    context?: CatalogMutationContext,
  ): Promise<CatalogCategoryRecord>;
  updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateCatalogProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductRecord>;
  updateProductVariant(
    tenantId: string,
    variantId: string,
    input: UpdateCatalogProductVariant,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductVariantRecord>;
  updateModifierGroup(
    tenantId: string,
    groupId: string,
    input: UpdateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierGroupRecord>;
  updateModifierOption(
    tenantId: string,
    optionId: string,
    input: UpdateCatalogModifierOption,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierOptionRecord>;
  updateProductModifierGroup(
    tenantId: string,
    assignmentId: string,
    input: UpdateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductModifierGroupRecord>;
  updateProductImage(
    tenantId: string,
    imageId: string,
    input: UpdateCatalogProductImage,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductImageRecord>;
  updateOutletProduct(
    tenantId: string,
    outletProductId: string,
    input: UpdateCatalogOutletProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogOutletProductRecord>;
}

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");
