import type { CreateCatalogOutletProduct, UpdateCatalogOutletProduct } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import {
  outletProductSelect,
  mapOutletProduct,
  writeCatalogChange,
} from "./prisma-catalog-shared.js";

export async function findOutlet(tenantId: string, outletId: string) {
  return getPrismaClient().outlet.findUnique({
    select: { id: true, status: true, tenantId: true },
    where: { tenantId_id: { id: outletId, tenantId } },
  });
}

export async function findOutletProductById(tenantId: string, outletProductId: string) {
  const outletProduct = await getPrismaClient().catalogOutletProduct.findUnique({
    select: outletProductSelect,
    where: { tenantId_id: { id: outletProductId, tenantId } },
  });
  return outletProduct ? mapOutletProduct(outletProduct) : null;
}

export async function findOutletProduct(tenantId: string, outletId: string, productId: string) {
  const outletProduct = await getPrismaClient().catalogOutletProduct.findUnique({
    select: outletProductSelect,
    where: { tenantId_outletId_productId: { outletId, productId, tenantId } },
  });
  return outletProduct ? mapOutletProduct(outletProduct) : null;
}

export async function createOutletProduct(
  tenantId: string,
  input: CreateCatalogOutletProduct,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const outletProductRecord = await transaction.catalogOutletProduct.create({
      data: {
        availabilityOverride: input.availabilityOverride,
        displayOrder: input.displayOrder,
        outletId: input.outletId,
        priceOverrideMinor:
          input.priceOverrideMinor === null ? null : BigInt(input.priceOverrideMinor),
        productId: input.productId,
        tenantId,
      },
      select: outletProductSelect,
    });
    const outletProduct = mapOutletProduct(outletProductRecord);
    await writeCatalogChange(transaction, {
      after: outletProduct,
      ...(context ? { context } : {}),
      entityType: "catalog_outlet_product",
      operation: "created",
      tenantId,
    });
    return outletProduct;
  });
}

export async function updateOutletProduct(
  tenantId: string,
  outletProductId: string,
  input: UpdateCatalogOutletProduct,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const beforeRecord = await transaction.catalogOutletProduct.findUniqueOrThrow({
      select: outletProductSelect,
      where: { tenantId_id: { id: outletProductId, tenantId } },
    });
    const outletProductRecord = await transaction.catalogOutletProduct.update({
      data: {
        ...(input.availabilityOverride !== undefined
          ? { availabilityOverride: input.availabilityOverride }
          : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.priceOverrideMinor !== undefined
          ? {
              priceOverrideMinor:
                input.priceOverrideMinor === null ? null : BigInt(input.priceOverrideMinor),
            }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: outletProductSelect,
      where: { tenantId_id: { id: outletProductId, tenantId } },
    });
    const before = mapOutletProduct(beforeRecord);
    const outletProduct = mapOutletProduct(outletProductRecord);
    await writeCatalogChange(transaction, {
      after: outletProduct,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_outlet_product",
      operation: "updated",
      tenantId,
    });
    return outletProduct;
  });
}
