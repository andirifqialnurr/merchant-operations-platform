import type { CreateCatalogCategory, UpdateCatalogCategory } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import { categorySelect, writeCatalogChange } from "./prisma-catalog-shared.js";

export async function findCategoryById(tenantId: string, categoryId: string) {
  return getPrismaClient().catalogCategory.findUnique({
    select: categorySelect,
    where: { tenantId_id: { id: categoryId, tenantId } },
  });
}

export async function findCategoryBySlug(tenantId: string, slug: string) {
  return getPrismaClient().catalogCategory.findUnique({
    select: categorySelect,
    where: { tenantId_slug: { slug, tenantId } },
  });
}

export async function createCategory(
  tenantId: string,
  input: CreateCatalogCategory,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const category = await transaction.catalogCategory.create({
      data: { ...input, tenantId },
      select: categorySelect,
    });
    await writeCatalogChange(transaction, {
      after: category,
      ...(context ? { context } : {}),
      entityType: "catalog_category",
      operation: "created",
      tenantId,
    });
    return category;
  });
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  input: UpdateCatalogCategory,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const before = await transaction.catalogCategory.findUniqueOrThrow({
      select: categorySelect,
      where: { tenantId_id: { id: categoryId, tenantId } },
    });
    const category = await transaction.catalogCategory.update({
      data: {
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: categorySelect,
      where: { tenantId_id: { id: categoryId, tenantId } },
    });
    await writeCatalogChange(transaction, {
      after: category,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_category",
      operation: "updated",
      tenantId,
    });
    return category;
  });
}
