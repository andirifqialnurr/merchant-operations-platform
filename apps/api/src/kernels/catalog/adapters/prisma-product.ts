import type { CreateCatalogProduct, UpdateCatalogProduct } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import { productSelect, mapProduct, writeCatalogChange } from "./prisma-catalog-shared.js";

export async function findProductById(tenantId: string, productId: string) {
  const product = await getPrismaClient().catalogProduct.findUnique({
    select: productSelect,
    where: { tenantId_id: { id: productId, tenantId } },
  });
  return product ? mapProduct(product) : null;
}

export async function findProductBySlug(tenantId: string, slug: string) {
  const product = await getPrismaClient().catalogProduct.findUnique({
    select: productSelect,
    where: { tenantId_slug: { slug, tenantId } },
  });
  return product ? mapProduct(product) : null;
}

export async function createProduct(
  tenantId: string,
  input: CreateCatalogProduct,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    // Read under a lock shared with changing the currency of the workspace:
    // the price is recorded in the currency that is in force when it commits.
    const workspace = await transaction.$queryRaw<Array<{ currency: string }>>`
      SELECT currency FROM tenants WHERE id = ${tenantId}::uuid FOR SHARE`;
    const currency = workspace[0]?.currency;
    if (!currency) throw new Error("Workspace not found while creating a product.");
    const productRecord = await transaction.catalogProduct.create({
      data: {
        ...input,
        currency,
        basePriceMinor: BigInt(input.basePriceMinor),
        description: input.description ?? null,
        tenantId,
      },
      select: productSelect,
    });
    const product = mapProduct(productRecord);
    await writeCatalogChange(transaction, {
      after: product,
      ...(context ? { context } : {}),
      entityType: "catalog_product",
      operation: "created",
      tenantId,
    });
    return product;
  });
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  input: UpdateCatalogProduct,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const beforeRecord = await transaction.catalogProduct.findUniqueOrThrow({
      select: productSelect,
      where: { tenantId_id: { id: productId, tenantId } },
    });
    const productRecord = await transaction.catalogProduct.update({
      data: {
        ...(input.availability !== undefined ? { availability: input.availability } : {}),
        ...(input.basePriceMinor !== undefined
          ? { basePriceMinor: BigInt(input.basePriceMinor) }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: productSelect,
      where: { tenantId_id: { id: productId, tenantId } },
    });
    const before = mapProduct(beforeRecord);
    const product = mapProduct(productRecord);
    await writeCatalogChange(transaction, {
      after: product,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_product",
      operation: "updated",
      tenantId,
    });
    return product;
  });
}
