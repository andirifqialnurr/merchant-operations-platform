import {
  type CreateCatalogCategory,
  type CreateCatalogModifierGroup,
  type CreateCatalogModifierOption,
  type CreateCatalogOutletProduct,
  type CreateCatalogProduct,
  type CreateCatalogProductImage,
  type CreateCatalogProductModifierGroup,
  type CreateCatalogProductVariant,
  type UpdateCatalogCategory,
  type UpdateCatalogModifierGroup,
  type UpdateCatalogModifierOption,
  type UpdateCatalogOutletProduct,
  type UpdateCatalogProduct,
  type UpdateCatalogProductImage,
  type UpdateCatalogProductModifierGroup,
  type UpdateCatalogProductVariant,
} from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";
import {
  CATALOG_REPOSITORY,
  type CatalogMutationContext,
  type CatalogRepository,
} from "./catalog.repository.js";
import { LIMIT_GATE, NO_LIMITS, type LimitGate } from "../../../shared/limits/limit-gate.js";
import { FileStorageService } from "../../../core/files/public.js";
import { type CatalogDeps, type ProductImageFiles } from "./catalog-deps.js";
import { createCategory as createCategoryUseCase } from "./commands/create-category.js";
import { updateCategory as updateCategoryUseCase } from "./commands/update-category.js";
import { createProduct as createProductUseCase } from "./commands/create-product.js";
import { updateProduct as updateProductUseCase } from "./commands/update-product.js";
import { createProductVariant as createProductVariantUseCase } from "./commands/create-product-variant.js";
import { updateProductVariant as updateProductVariantUseCase } from "./commands/update-product-variant.js";
import { createModifierGroup as createModifierGroupUseCase } from "./commands/create-modifier-group.js";
import { updateModifierGroup as updateModifierGroupUseCase } from "./commands/update-modifier-group.js";
import { createModifierOption as createModifierOptionUseCase } from "./commands/create-modifier-option.js";
import { updateModifierOption as updateModifierOptionUseCase } from "./commands/update-modifier-option.js";
import { createProductModifierGroup as createProductModifierGroupUseCase } from "./commands/create-product-modifier-group.js";
import { updateProductModifierGroup as updateProductModifierGroupUseCase } from "./commands/update-product-modifier-group.js";
import { createProductImage as createProductImageUseCase } from "./commands/create-product-image.js";
import { productImageUrl as productImageUrlUseCase } from "./queries/product-image-url.js";
import { primaryProductImageContent } from "./queries/primary-product-image-content.js";
import { updateProductImage as updateProductImageUseCase } from "./commands/update-product-image.js";
import { createOutletProduct as createOutletProductUseCase } from "./commands/create-outlet-product.js";
import { updateOutletProduct as updateOutletProductUseCase } from "./commands/update-outlet-product.js";
import { getOutletCatalog as getOutletCatalogUseCase } from "./queries/get-outlet-catalog.js";
import { getSellableMenu as getSellableMenuUseCase } from "./queries/get-sellable-menu.js";
import { getSnapshot as getSnapshotUseCase } from "./queries/get-snapshot.js";

/**
 * The catalog as other units and the HTTP adapters call it. Each method is one
 * use case in its own file under commands/ or queries/; this class only hands
 * them what they work with.
 */
@Injectable()
export class CatalogService {
  private readonly deps: CatalogDeps;

  constructor(
    @Inject(CATALOG_REPOSITORY) repository: CatalogRepository,
    @Inject(LIMIT_GATE) limits: LimitGate = NO_LIMITS,
    // Left out only by unit tests that are not about pictures.
    @Inject(FileStorageService) files?: ProductImageFiles,
  ) {
    this.deps = { files, limits, repository };
  }

  createCategory(tenantId: string, input: CreateCatalogCategory, context?: CatalogMutationContext) {
    return createCategoryUseCase(this.deps, tenantId, input, context);
  }

  updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateCatalogCategory,
    context?: CatalogMutationContext,
  ) {
    return updateCategoryUseCase(this.deps, tenantId, categoryId, input, context);
  }

  createProduct(tenantId: string, input: CreateCatalogProduct, context?: CatalogMutationContext) {
    return createProductUseCase(this.deps, tenantId, input, context);
  }

  updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateCatalogProduct,
    context?: CatalogMutationContext,
  ) {
    return updateProductUseCase(this.deps, tenantId, productId, input, context);
  }

  createProductVariant(
    tenantId: string,
    input: CreateCatalogProductVariant,
    context?: CatalogMutationContext,
  ) {
    return createProductVariantUseCase(this.deps, tenantId, input, context);
  }

  updateProductVariant(
    tenantId: string,
    variantId: string,
    input: UpdateCatalogProductVariant,
    context?: CatalogMutationContext,
  ) {
    return updateProductVariantUseCase(this.deps, tenantId, variantId, input, context);
  }

  createModifierGroup(
    tenantId: string,
    input: CreateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ) {
    return createModifierGroupUseCase(this.deps, tenantId, input, context);
  }

  updateModifierGroup(
    tenantId: string,
    groupId: string,
    input: UpdateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ) {
    return updateModifierGroupUseCase(this.deps, tenantId, groupId, input, context);
  }

  createModifierOption(
    tenantId: string,
    input: CreateCatalogModifierOption,
    context?: CatalogMutationContext,
  ) {
    return createModifierOptionUseCase(this.deps, tenantId, input, context);
  }

  updateModifierOption(
    tenantId: string,
    optionId: string,
    input: UpdateCatalogModifierOption,
    context?: CatalogMutationContext,
  ) {
    return updateModifierOptionUseCase(this.deps, tenantId, optionId, input, context);
  }

  createProductModifierGroup(
    tenantId: string,
    input: CreateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ) {
    return createProductModifierGroupUseCase(this.deps, tenantId, input, context);
  }

  updateProductModifierGroup(
    tenantId: string,
    assignmentId: string,
    input: UpdateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ) {
    return updateProductModifierGroupUseCase(this.deps, tenantId, assignmentId, input, context);
  }

  createProductImage(
    tenantId: string,
    input: CreateCatalogProductImage,
    context?: CatalogMutationContext,
  ) {
    return createProductImageUseCase(this.deps, tenantId, input, context);
  }

  /** A short-lived address for showing an active picture; null when there is none. */
  primaryProductImageContent(tenantId: string, imageId: string) {
    return primaryProductImageContent(this.deps, tenantId, imageId);
  }

  productImageUrl(tenantId: string, imageId: string) {
    return productImageUrlUseCase(this.deps, tenantId, imageId);
  }

  updateProductImage(
    tenantId: string,
    imageId: string,
    input: UpdateCatalogProductImage,
    context?: CatalogMutationContext,
  ) {
    return updateProductImageUseCase(this.deps, tenantId, imageId, input, context);
  }

  createOutletProduct(
    tenantId: string,
    input: CreateCatalogOutletProduct,
    context?: CatalogMutationContext,
  ) {
    return createOutletProductUseCase(this.deps, tenantId, input, context);
  }

  updateOutletProduct(
    tenantId: string,
    outletProductId: string,
    input: UpdateCatalogOutletProduct,
    context?: CatalogMutationContext,
    expectedOutletId?: string,
  ) {
    return updateOutletProductUseCase(
      this.deps,
      tenantId,
      outletProductId,
      input,
      context,
      expectedOutletId,
    );
  }

  getOutletCatalog(tenantId: string, outletId: string) {
    return getOutletCatalogUseCase(this.deps, tenantId, outletId);
  }

  /** The outlet's sellable menu; empty while the tenant or outlet is inactive. */
  getSellableMenu(tenantId: string, outletId: string) {
    return getSellableMenuUseCase(this.deps, tenantId, outletId);
  }

  getSnapshot(tenantId: string) {
    return getSnapshotUseCase(this.deps, tenantId);
  }
}
