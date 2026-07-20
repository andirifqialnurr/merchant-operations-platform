import {
  catalogCategorySchema,
  catalogProductSchema,
  catalogSnapshotSchema,
  createCatalogCategorySchema,
  createCatalogProductSchema,
  updateCatalogCategorySchema,
  updateCatalogProductSchema,
  type CatalogCategory,
  type CatalogProduct,
  type CreateCatalogCategory,
  type CreateCatalogProduct,
  type UpdateCatalogCategory,
  type UpdateCatalogProduct,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  CATALOG_REPOSITORY,
  type CatalogCategoryRecord,
  type CatalogMutationContext,
  type CatalogProductRecord,
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

  async getSnapshot(tenantId: string) {
    const snapshot = await this.repository.getSnapshot(tenantId);
    if (!snapshot) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    return catalogSnapshotSchema.parse({
      categories: snapshot.categories.map(toCategory),
      products: snapshot.products.map(toProduct),
    });
  }
}
