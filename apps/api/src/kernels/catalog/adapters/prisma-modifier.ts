import type {
  CreateCatalogModifierGroup,
  CreateCatalogModifierOption,
  UpdateCatalogModifierGroup,
  UpdateCatalogModifierOption,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import type { CatalogMutationContext } from "../domain/catalog-records.js";
import {
  modifierGroupSelect,
  modifierOptionSelect,
  mapModifierOption,
  writeCatalogChange,
} from "./prisma-catalog-shared.js";

export async function findModifierGroupById(tenantId: string, groupId: string) {
  return getPrismaClient().catalogModifierGroup.findUnique({
    select: modifierGroupSelect,
    where: { tenantId_id: { id: groupId, tenantId } },
  });
}

export async function findModifierGroupByName(tenantId: string, name: string) {
  return getPrismaClient().catalogModifierGroup.findUnique({
    select: modifierGroupSelect,
    where: { tenantId_name: { name, tenantId } },
  });
}

export async function createModifierGroup(
  tenantId: string,
  input: CreateCatalogModifierGroup,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const group = await transaction.catalogModifierGroup.create({
      data: { ...input, tenantId },
      select: modifierGroupSelect,
    });
    await writeCatalogChange(transaction, {
      after: group,
      ...(context ? { context } : {}),
      entityType: "catalog_modifier_group",
      operation: "created",
      tenantId,
    });
    return group;
  });
}

export async function updateModifierGroup(
  tenantId: string,
  groupId: string,
  input: UpdateCatalogModifierGroup,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const before = await transaction.catalogModifierGroup.findUniqueOrThrow({
      select: modifierGroupSelect,
      where: { tenantId_id: { id: groupId, tenantId } },
    });
    const group = await transaction.catalogModifierGroup.update({
      data: {
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.maxSelections !== undefined ? { maxSelections: input.maxSelections } : {}),
        ...(input.minSelections !== undefined ? { minSelections: input.minSelections } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.selectionType !== undefined ? { selectionType: input.selectionType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: modifierGroupSelect,
      where: { tenantId_id: { id: groupId, tenantId } },
    });
    await writeCatalogChange(transaction, {
      after: group,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_modifier_group",
      operation: "updated",
      tenantId,
    });
    return group;
  });
}

export async function findModifierOptionById(tenantId: string, optionId: string) {
  const option = await getPrismaClient().catalogModifierOption.findUnique({
    select: modifierOptionSelect,
    where: { tenantId_id: { id: optionId, tenantId } },
  });
  return option ? mapModifierOption(option) : null;
}

export async function findModifierOptionByName(tenantId: string, groupId: string, name: string) {
  const option = await getPrismaClient().catalogModifierOption.findUnique({
    select: modifierOptionSelect,
    where: { tenantId_groupId_name: { groupId, name, tenantId } },
  });
  return option ? mapModifierOption(option) : null;
}

export async function createModifierOption(
  tenantId: string,
  input: CreateCatalogModifierOption,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const optionRecord = await transaction.catalogModifierOption.create({
      data: { ...input, priceDeltaMinor: BigInt(input.priceDeltaMinor), tenantId },
      select: modifierOptionSelect,
    });
    const option = mapModifierOption(optionRecord);
    await writeCatalogChange(transaction, {
      after: option,
      ...(context ? { context } : {}),
      entityType: "catalog_modifier_option",
      operation: "created",
      tenantId,
    });
    return option;
  });
}

export async function updateModifierOption(
  tenantId: string,
  optionId: string,
  input: UpdateCatalogModifierOption,
  context?: CatalogMutationContext,
) {
  return getPrismaClient().$transaction(async (transaction) => {
    const beforeRecord = await transaction.catalogModifierOption.findUniqueOrThrow({
      select: modifierOptionSelect,
      where: { tenantId_id: { id: optionId, tenantId } },
    });
    const optionRecord = await transaction.catalogModifierOption.update({
      data: {
        ...(input.availability !== undefined ? { availability: input.availability } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.priceDeltaMinor !== undefined
          ? { priceDeltaMinor: BigInt(input.priceDeltaMinor) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: modifierOptionSelect,
      where: { tenantId_id: { id: optionId, tenantId } },
    });
    const before = mapModifierOption(beforeRecord);
    const option = mapModifierOption(optionRecord);
    await writeCatalogChange(transaction, {
      after: option,
      before,
      ...(context ? { context } : {}),
      entityType: "catalog_modifier_option",
      operation: "updated",
      tenantId,
    });
    return option;
  });
}
