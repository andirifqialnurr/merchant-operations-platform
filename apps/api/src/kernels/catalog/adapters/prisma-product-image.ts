import type { CreateCatalogProductImage, UpdateCatalogProductImage } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import {
  productImageSelect,
  mapProductImage,
  writeCatalogChange,
  clearActivePrimaryImages,
} from "./prisma-catalog-shared.js";

export async function findProductImageById(tenantId: string, imageId: string) {
  const image = await getPrismaClient().catalogProductImage.findUnique({
    select: productImageSelect,
    where: { tenantId_id: { id: imageId, tenantId } },
  });
  return image ? mapProductImage(image) : null;
}

export async function findProductImageByObjectKey(tenantId: string, objectKey: string) {
  const image = await getPrismaClient().catalogProductImage.findUnique({
    select: productImageSelect,
    where: { tenantId_objectKey: { objectKey, tenantId } },
  });
  return image ? mapProductImage(image) : null;
}

export async function createProductImage(
  tenantId: string,
  input: CreateCatalogProductImage,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    if (input.isPrimary) {
      await clearActivePrimaryImages(transaction, tenantId, input.productId, context);
    }
    const imageRecord = await transaction.catalogProductImage.create({
      data: {
        altText: input.altText ?? null,
        contentType: input.contentType,
        displayOrder: input.displayOrder,
        height: input.height ?? null,
        isPrimary: input.isPrimary,
        objectKey: input.objectKey,
        productId: input.productId,
        tenantId,
        width: input.width ?? null,
      },
      select: productImageSelect,
    });
    const image = mapProductImage(imageRecord);
    await writeCatalogChange(transaction, {
      after: image,
      ...(context ? { context } : {}),
      entityType: "catalog_product_image",
      operation: "created",
      tenantId,
    });
    return image;
  });
}

export async function updateProductImage(
  tenantId: string,
  imageId: string,
  input: UpdateCatalogProductImage,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const beforeRecord = await transaction.catalogProductImage.findUniqueOrThrow({
      select: productImageSelect,
      where: { tenantId_id: { id: imageId, tenantId } },
    });
    const resultingStatus = input.status ?? beforeRecord.status;
    const resultingPrimary =
      resultingStatus === "INACTIVE" ? false : (input.isPrimary ?? beforeRecord.isPrimary);
    if (resultingPrimary) {
      await clearActivePrimaryImages(
        transaction,
        tenantId,
        beforeRecord.productId,
        context,
        imageId,
      );
    }
    const imageRecord = await transaction.catalogProductImage.update({
      data: {
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
        isPrimary: resultingPrimary,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
      },
      select: productImageSelect,
      where: { tenantId_id: { id: imageId, tenantId } },
    });
    const before = mapProductImage(beforeRecord);
    const image = mapProductImage(imageRecord);
    await writeCatalogChange(transaction, {
      after: image,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_product_image",
      operation: "updated",
      tenantId,
    });
    return image;
  });
}
