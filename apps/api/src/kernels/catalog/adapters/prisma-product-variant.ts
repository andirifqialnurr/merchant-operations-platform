import type { CreateCatalogProductVariant, UpdateCatalogProductVariant } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import {
  productVariantSelect,
  mapProductVariant,
  writeCatalogChange,
} from "./prisma-catalog-shared.js";

export async function findProductVariantById(tenantId: string, variantId: string) {
  const variant = await getPrismaClient().catalogProductVariant.findUnique({
    select: productVariantSelect,
    where: { tenantId_id: { id: variantId, tenantId } },
  });
  return variant ? mapProductVariant(variant) : null;
}

export async function createProductVariant(
  tenantId: string,
  input: CreateCatalogProductVariant,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const variantRecord = await transaction.catalogProductVariant.create({
      data: { ...input, priceDeltaMinor: BigInt(input.priceDeltaMinor), tenantId },
      select: productVariantSelect,
    });
    const variant = mapProductVariant(variantRecord);
    await writeCatalogChange(transaction, {
      after: variant,
      ...(context ? { context } : {}),
      entityType: "catalog_product_variant",
      operation: "created",
      tenantId,
    });
    return variant;
  });
}

export async function updateProductVariant(
  tenantId: string,
  variantId: string,
  input: UpdateCatalogProductVariant,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const beforeRecord = await transaction.catalogProductVariant.findUniqueOrThrow({
      select: productVariantSelect,
      where: { tenantId_id: { id: variantId, tenantId } },
    });
    const variantRecord = await transaction.catalogProductVariant.update({
      data: {
        ...(input.availability !== undefined ? { availability: input.availability } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.priceDeltaMinor !== undefined
          ? { priceDeltaMinor: BigInt(input.priceDeltaMinor) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: productVariantSelect,
      where: { tenantId_id: { id: variantId, tenantId } },
    });
    const before = mapProductVariant(beforeRecord);
    const variant = mapProductVariant(variantRecord);
    await writeCatalogChange(transaction, {
      after: variant,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_product_variant",
      operation: "updated",
      tenantId,
    });
    return variant;
  });
}
