import type {
  CreateCatalogProductModifierGroup,
  UpdateCatalogProductModifierGroup,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import { productModifierGroupSelect, writeCatalogChange } from "./prisma-catalog-shared.js";

export async function findProductModifierGroupById(tenantId: string, assignmentId: string) {
  return getPrismaClient().catalogProductModifierGroup.findUnique({
    select: productModifierGroupSelect,
    where: { tenantId_id: { id: assignmentId, tenantId } },
  });
}

export async function findProductModifierGroup(
  tenantId: string,
  productId: string,
  modifierGroupId: string,
) {
  return getPrismaClient().catalogProductModifierGroup.findUnique({
    select: productModifierGroupSelect,
    where: { tenantId_productId_modifierGroupId: { modifierGroupId, productId, tenantId } },
  });
}

export async function createProductModifierGroup(
  tenantId: string,
  input: CreateCatalogProductModifierGroup,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const assignment = await transaction.catalogProductModifierGroup.create({
      data: { ...input, tenantId },
      select: productModifierGroupSelect,
    });
    await writeCatalogChange(transaction, {
      after: assignment,
      ...(context ? { context } : {}),
      entityType: "catalog_product_modifier_group",
      operation: "created",
      tenantId,
    });
    return assignment;
  });
}

export async function updateProductModifierGroup(
  tenantId: string,
  assignmentId: string,
  input: UpdateCatalogProductModifierGroup,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const before = await transaction.catalogProductModifierGroup.findUniqueOrThrow({
      select: productModifierGroupSelect,
      where: { tenantId_id: { id: assignmentId, tenantId } },
    });
    const assignment = await transaction.catalogProductModifierGroup.update({
      data: {
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: productModifierGroupSelect,
      where: { tenantId_id: { id: assignmentId, tenantId } },
    });
    await writeCatalogChange(transaction, {
      after: assignment,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_product_modifier_group",
      operation: "updated",
      tenantId,
    });
    return assignment;
  });
}
