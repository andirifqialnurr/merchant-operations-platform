import {
  catalogCategorySchema,
  catalogModifierGroupSchema,
  catalogModifierOptionSchema,
  catalogProductSchema,
  catalogProductImageSchema,
  catalogProductModifierGroupSchema,
  catalogProductVariantSchema,
  catalogSnapshotSchema,
  createCatalogCategorySchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogProductSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductVariantSchema,
  updateCatalogCategorySchema,
  updateCatalogModifierGroupSchema,
  updateCatalogModifierOptionSchema,
  updateCatalogProductSchema,
  updateCatalogProductImageSchema,
  updateCatalogProductModifierGroupSchema,
  updateCatalogProductVariantSchema,
  type CatalogCategory,
  type CatalogModifierGroup,
  type CatalogModifierOption,
  type CatalogProduct,
  type CatalogProductImage,
  type CatalogProductModifierGroup,
  type CatalogProductVariant,
  type CreateCatalogCategory,
  type CreateCatalogModifierGroup,
  type CreateCatalogModifierOption,
  type CreateCatalogProduct,
  type CreateCatalogProductImage,
  type CreateCatalogProductModifierGroup,
  type CreateCatalogProductVariant,
  type UpdateCatalogCategory,
  type UpdateCatalogModifierGroup,
  type UpdateCatalogModifierOption,
  type UpdateCatalogProduct,
  type UpdateCatalogProductImage,
  type UpdateCatalogProductModifierGroup,
  type UpdateCatalogProductVariant,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  CATALOG_REPOSITORY,
  type CatalogCategoryRecord,
  type CatalogModifierGroupRecord,
  type CatalogModifierOptionRecord,
  type CatalogMutationContext,
  type CatalogProductRecord,
  type CatalogProductImageRecord,
  type CatalogProductModifierGroupRecord,
  type CatalogProductVariantRecord,
  type CatalogRepository,
} from "./catalog.repository.js";

const notFound = (code: string, message: string) => new NotFoundException({ code, message });
const conflict = (code: string, message: string) => new ConflictException({ code, message });

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function toCategory(record: CatalogCategoryRecord): CatalogCategory {
  return catalogCategorySchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProduct(record: CatalogProductRecord): CatalogProduct {
  return catalogProductSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProductVariant(record: CatalogProductVariantRecord): CatalogProductVariant {
  return catalogProductVariantSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toModifierGroup(record: CatalogModifierGroupRecord): CatalogModifierGroup {
  return catalogModifierGroupSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toModifierOption(record: CatalogModifierOptionRecord): CatalogModifierOption {
  return catalogModifierOptionSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProductModifierGroup(
  record: CatalogProductModifierGroupRecord,
): CatalogProductModifierGroup {
  return catalogProductModifierGroupSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProductImage(record: CatalogProductImageRecord): CatalogProductImage {
  return catalogProductImageSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

@Injectable()
export class CatalogService {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository) {}

  private async requireActiveTenant(tenantId: string) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    if (tenant.status !== "ACTIVE") throw conflict("TENANT_INACTIVE", "Tenant tidak aktif.");
  }

  private async requireCategory(tenantId: string, categoryId: string) {
    const category = await this.repository.findCategoryById(tenantId, categoryId);
    if (!category) {
      throw notFound("CATALOG_CATEGORY_NOT_FOUND", "Kategori tidak ditemukan pada tenant ini.");
    }
    return category;
  }

  private async requireActiveCategory(tenantId: string, categoryId: string) {
    const category = await this.requireCategory(tenantId, categoryId);
    if (category.status !== "ACTIVE") {
      throw conflict("CATALOG_CATEGORY_INACTIVE", "Kategori tidak aktif.");
    }
    return category;
  }

  private async requireProduct(tenantId: string, productId: string) {
    const product = await this.repository.findProductById(tenantId, productId);
    if (!product) {
      throw notFound("CATALOG_PRODUCT_NOT_FOUND", "Produk tidak ditemukan pada tenant ini.");
    }
    return product;
  }

  private async requireActiveProduct(tenantId: string, productId: string) {
    const product = await this.requireProduct(tenantId, productId);
    if (product.status !== "ACTIVE") {
      throw conflict("CATALOG_PRODUCT_INACTIVE", "Produk tidak aktif.");
    }
    return product;
  }

  private async requireModifierGroup(tenantId: string, groupId: string) {
    const group = await this.repository.findModifierGroupById(tenantId, groupId);
    if (!group) {
      throw notFound(
        "CATALOG_MODIFIER_GROUP_NOT_FOUND",
        "Modifier group tidak ditemukan pada tenant ini.",
      );
    }
    return group;
  }

  private async requireActiveModifierGroup(tenantId: string, groupId: string) {
    const group = await this.requireModifierGroup(tenantId, groupId);
    if (group.status !== "ACTIVE") {
      throw conflict("CATALOG_MODIFIER_GROUP_INACTIVE", "Modifier group tidak aktif.");
    }
    return group;
  }

  private async uniqueMutation<T>(operation: () => Promise<T>, code: string, message: string) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueConstraintError(error)) throw conflict(code, message);
      throw error;
    }
  }

  async createCategory(
    tenantId: string,
    input: CreateCatalogCategory,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogCategorySchema.parse(input);
    if (await this.repository.findCategoryBySlug(tenantId, parsed.slug)) {
      throw conflict("CATALOG_CATEGORY_SLUG_CONFLICT", "Slug kategori sudah digunakan.");
    }
    const record = await this.uniqueMutation(
      () => this.repository.createCategory(tenantId, parsed, context),
      "CATALOG_CATEGORY_SLUG_CONFLICT",
      "Slug kategori sudah digunakan.",
    );
    return toCategory(record);
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateCatalogCategory,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.requireCategory(tenantId, categoryId);
    const parsed = updateCatalogCategorySchema.parse(input);
    if (parsed.slug && parsed.slug !== current.slug) {
      const duplicate = await this.repository.findCategoryBySlug(tenantId, parsed.slug);
      if (duplicate && duplicate.id !== categoryId) {
        throw conflict("CATALOG_CATEGORY_SLUG_CONFLICT", "Slug kategori sudah digunakan.");
      }
    }
    const record = await this.uniqueMutation(
      () => this.repository.updateCategory(tenantId, categoryId, parsed, context),
      "CATALOG_CATEGORY_SLUG_CONFLICT",
      "Slug kategori sudah digunakan.",
    );
    return toCategory(record);
  }

  async createProduct(
    tenantId: string,
    input: CreateCatalogProduct,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogProductSchema.parse(input);
    await this.requireActiveCategory(tenantId, parsed.categoryId);
    if (await this.repository.findProductBySlug(tenantId, parsed.slug)) {
      throw conflict("CATALOG_PRODUCT_SLUG_CONFLICT", "Slug produk sudah digunakan.");
    }
    const record = await this.uniqueMutation(
      () => this.repository.createProduct(tenantId, parsed, context),
      "CATALOG_PRODUCT_SLUG_CONFLICT",
      "Slug produk sudah digunakan.",
    );
    return toProduct(record);
  }

  async updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateCatalogProduct,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findProductById(tenantId, productId);
    if (!current) {
      throw notFound("CATALOG_PRODUCT_NOT_FOUND", "Produk tidak ditemukan pada tenant ini.");
    }
    const parsed = updateCatalogProductSchema.parse(input);
    if (parsed.categoryId && parsed.categoryId !== current.categoryId) {
      await this.requireActiveCategory(tenantId, parsed.categoryId);
    }
    if (parsed.slug && parsed.slug !== current.slug) {
      const duplicate = await this.repository.findProductBySlug(tenantId, parsed.slug);
      if (duplicate && duplicate.id !== productId) {
        throw conflict("CATALOG_PRODUCT_SLUG_CONFLICT", "Slug produk sudah digunakan.");
      }
    }
    const record = await this.uniqueMutation(
      () => this.repository.updateProduct(tenantId, productId, parsed, context),
      "CATALOG_PRODUCT_SLUG_CONFLICT",
      "Slug produk sudah digunakan.",
    );
    return toProduct(record);
  }

  async createProductVariant(
    tenantId: string,
    input: CreateCatalogProductVariant,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogProductVariantSchema.parse(input);
    await this.requireActiveProduct(tenantId, parsed.productId);
    const record = await this.uniqueMutation(
      () => this.repository.createProductVariant(tenantId, parsed, context),
      "CATALOG_PRODUCT_VARIANT_CONFLICT",
      "Nama variant sudah digunakan pada produk ini.",
    );
    return toProductVariant(record);
  }

  async updateProductVariant(
    tenantId: string,
    variantId: string,
    input: UpdateCatalogProductVariant,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findProductVariantById(tenantId, variantId);
    if (!current) {
      throw notFound(
        "CATALOG_PRODUCT_VARIANT_NOT_FOUND",
        "Variant tidak ditemukan pada tenant ini.",
      );
    }
    const parsed = updateCatalogProductVariantSchema.parse(input);
    const record = await this.uniqueMutation(
      () => this.repository.updateProductVariant(tenantId, variantId, parsed, context),
      "CATALOG_PRODUCT_VARIANT_CONFLICT",
      "Nama variant sudah digunakan pada produk ini.",
    );
    return toProductVariant(record);
  }

  async createModifierGroup(
    tenantId: string,
    input: CreateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogModifierGroupSchema.parse(input);
    if (await this.repository.findModifierGroupByName(tenantId, parsed.name)) {
      throw conflict(
        "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
        "Nama modifier group sudah digunakan.",
      );
    }
    const record = await this.uniqueMutation(
      () => this.repository.createModifierGroup(tenantId, parsed, context),
      "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
      "Nama modifier group sudah digunakan.",
    );
    return toModifierGroup(record);
  }

  async updateModifierGroup(
    tenantId: string,
    groupId: string,
    input: UpdateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.requireModifierGroup(tenantId, groupId);
    const parsed = updateCatalogModifierGroupSchema.parse(input);
    createCatalogModifierGroupSchema.parse({
      displayOrder: parsed.displayOrder ?? current.displayOrder,
      maxSelections: parsed.maxSelections ?? current.maxSelections,
      minSelections: parsed.minSelections ?? current.minSelections,
      name: parsed.name ?? current.name,
      selectionType: parsed.selectionType ?? current.selectionType,
    });
    if (parsed.name && parsed.name !== current.name) {
      const duplicate = await this.repository.findModifierGroupByName(tenantId, parsed.name);
      if (duplicate && duplicate.id !== groupId) {
        throw conflict(
          "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
          "Nama modifier group sudah digunakan.",
        );
      }
    }
    const record = await this.uniqueMutation(
      () => this.repository.updateModifierGroup(tenantId, groupId, parsed, context),
      "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
      "Nama modifier group sudah digunakan.",
    );
    return toModifierGroup(record);
  }

  async createModifierOption(
    tenantId: string,
    input: CreateCatalogModifierOption,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogModifierOptionSchema.parse(input);
    await this.requireActiveModifierGroup(tenantId, parsed.groupId);
    if (await this.repository.findModifierOptionByName(tenantId, parsed.groupId, parsed.name)) {
      throw conflict(
        "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
        "Nama modifier option sudah digunakan pada group ini.",
      );
    }
    const record = await this.uniqueMutation(
      () => this.repository.createModifierOption(tenantId, parsed, context),
      "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
      "Nama modifier option sudah digunakan pada group ini.",
    );
    return toModifierOption(record);
  }

  async updateModifierOption(
    tenantId: string,
    optionId: string,
    input: UpdateCatalogModifierOption,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findModifierOptionById(tenantId, optionId);
    if (!current) {
      throw notFound(
        "CATALOG_MODIFIER_OPTION_NOT_FOUND",
        "Modifier option tidak ditemukan pada tenant ini.",
      );
    }
    const parsed = updateCatalogModifierOptionSchema.parse(input);
    if (parsed.name && parsed.name !== current.name) {
      const duplicate = await this.repository.findModifierOptionByName(
        tenantId,
        current.groupId,
        parsed.name,
      );
      if (duplicate && duplicate.id !== optionId) {
        throw conflict(
          "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
          "Nama modifier option sudah digunakan pada group ini.",
        );
      }
    }
    const record = await this.uniqueMutation(
      () => this.repository.updateModifierOption(tenantId, optionId, parsed, context),
      "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
      "Nama modifier option sudah digunakan pada group ini.",
    );
    return toModifierOption(record);
  }

  async createProductModifierGroup(
    tenantId: string,
    input: CreateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogProductModifierGroupSchema.parse(input);
    await this.requireActiveProduct(tenantId, parsed.productId);
    await this.requireActiveModifierGroup(tenantId, parsed.modifierGroupId);
    if (
      await this.repository.findProductModifierGroup(
        tenantId,
        parsed.productId,
        parsed.modifierGroupId,
      )
    ) {
      throw conflict(
        "CATALOG_PRODUCT_MODIFIER_GROUP_CONFLICT",
        "Modifier group sudah terhubung ke produk ini.",
      );
    }
    const record = await this.uniqueMutation(
      () => this.repository.createProductModifierGroup(tenantId, parsed, context),
      "CATALOG_PRODUCT_MODIFIER_GROUP_CONFLICT",
      "Modifier group sudah terhubung ke produk ini.",
    );
    return toProductModifierGroup(record);
  }

  async updateProductModifierGroup(
    tenantId: string,
    assignmentId: string,
    input: UpdateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findProductModifierGroupById(tenantId, assignmentId);
    if (!current) {
      throw notFound(
        "CATALOG_PRODUCT_MODIFIER_GROUP_NOT_FOUND",
        "Assignment modifier tidak ditemukan pada tenant ini.",
      );
    }
    const parsed = updateCatalogProductModifierGroupSchema.parse(input);
    return toProductModifierGroup(
      await this.repository.updateProductModifierGroup(tenantId, assignmentId, parsed, context),
    );
  }

  async createProductImage(
    tenantId: string,
    input: CreateCatalogProductImage,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createCatalogProductImageSchema.parse(input);
    await this.requireActiveProduct(tenantId, parsed.productId);
    if (await this.repository.findProductImageByObjectKey(tenantId, parsed.objectKey)) {
      throw conflict("CATALOG_PRODUCT_IMAGE_KEY_CONFLICT", "Object key image sudah digunakan.");
    }
    const record = await this.uniqueMutation(
      () => this.repository.createProductImage(tenantId, parsed, context),
      "CATALOG_PRODUCT_IMAGE_KEY_CONFLICT",
      "Object key image sudah digunakan.",
    );
    return toProductImage(record);
  }

  async updateProductImage(
    tenantId: string,
    imageId: string,
    input: UpdateCatalogProductImage,
    context?: CatalogMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    if (!(await this.repository.findProductImageById(tenantId, imageId))) {
      throw notFound(
        "CATALOG_PRODUCT_IMAGE_NOT_FOUND",
        "Product image tidak ditemukan pada tenant ini.",
      );
    }
    const parsed = updateCatalogProductImageSchema.parse(input);
    return toProductImage(
      await this.repository.updateProductImage(tenantId, imageId, parsed, context),
    );
  }

  async getSnapshot(tenantId: string) {
    const snapshot = await this.repository.getSnapshot(tenantId);
    if (!snapshot) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    return catalogSnapshotSchema.parse({
      categories: snapshot.categories.map(toCategory),
      modifierGroups: snapshot.modifierGroups.map(toModifierGroup),
      modifierOptions: snapshot.modifierOptions.map(toModifierOption),
      productImages: snapshot.productImages.map(toProductImage),
      productModifierGroups: snapshot.productModifierGroups.map(toProductModifierGroup),
      productVariants: snapshot.productVariants.map(toProductVariant),
      products: snapshot.products.map(toProduct),
    });
  }
}
