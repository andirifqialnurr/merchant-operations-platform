import { type DatabaseClient } from "@merchant/database";
import { buildAuditMetadata } from "../../../core/audit/public.js";
import { eventOrigin } from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";
import type {
  CatalogMutationContext,
  CatalogCategoryRecord,
  CatalogProductRecord,
  CatalogProductVariantRecord,
  CatalogModifierGroupRecord,
  CatalogModifierOptionRecord,
  CatalogProductModifierGroupRecord,
  CatalogProductImageRecord,
  CatalogOutletProductRecord,
} from "../domain/catalog-records.js";

/* Shared by the Prisma adapters of the catalog: what is selected, how rows become records, and how a change is audited and announced. */

export const categorySelect = {
  createdAt: true,
  displayOrder: true,
  id: true,
  name: true,
  slug: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const productSelect = {
  availability: true,
  basePriceMinor: true,
  categoryId: true,
  createdAt: true,
  currency: true,
  description: true,
  id: true,
  name: true,
  slug: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const productVariantSelect = {
  availability: true,
  createdAt: true,
  displayOrder: true,
  id: true,
  name: true,
  priceDeltaMinor: true,
  productId: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const modifierGroupSelect = {
  createdAt: true,
  displayOrder: true,
  id: true,
  maxSelections: true,
  minSelections: true,
  name: true,
  selectionType: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const modifierOptionSelect = {
  availability: true,
  createdAt: true,
  displayOrder: true,
  groupId: true,
  id: true,
  name: true,
  priceDeltaMinor: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const productModifierGroupSelect = {
  createdAt: true,
  displayOrder: true,
  id: true,
  modifierGroupId: true,
  productId: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export const productImageSelect = {
  altText: true,
  contentType: true,
  createdAt: true,
  displayOrder: true,
  height: true,
  id: true,
  isPrimary: true,
  objectKey: true,
  productId: true,
  status: true,
  tenantId: true,
  updatedAt: true,
  width: true,
} as const;

export const outletProductSelect = {
  availabilityOverride: true,
  createdAt: true,
  displayOrder: true,
  id: true,
  outletId: true,
  priceOverrideMinor: true,
  productId: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

export type PrismaProductRecord = Omit<CatalogProductRecord, "basePriceMinor"> & {
  basePriceMinor: bigint;
};

export type PrismaProductVariantRecord = Omit<CatalogProductVariantRecord, "priceDeltaMinor"> & {
  priceDeltaMinor: bigint;
};

export type PrismaModifierOptionRecord = Omit<CatalogModifierOptionRecord, "priceDeltaMinor"> & {
  priceDeltaMinor: bigint;
};

export type PrismaOutletProductRecord = Omit<CatalogOutletProductRecord, "priceOverrideMinor"> & {
  priceOverrideMinor: bigint | null;
};

export type CatalogChangeRecord =
  | CatalogCategoryRecord
  | CatalogProductRecord
  | CatalogProductVariantRecord
  | CatalogModifierGroupRecord
  | CatalogModifierOptionRecord
  | CatalogProductModifierGroupRecord
  | CatalogProductImageRecord
  | CatalogOutletProductRecord;

export type TransactionClient = Pick<
  DatabaseClient,
  "auditLog" | "catalogProductImage" | "outboxEvent"
>;

export function mapProduct(record: PrismaProductRecord): CatalogProductRecord {
  return { ...record, basePriceMinor: record.basePriceMinor.toString() };
}

export function mapProductVariant(record: PrismaProductVariantRecord): CatalogProductVariantRecord {
  return { ...record, priceDeltaMinor: record.priceDeltaMinor.toString() };
}

export function mapModifierOption(record: PrismaModifierOptionRecord): CatalogModifierOptionRecord {
  return { ...record, priceDeltaMinor: record.priceDeltaMinor.toString() };
}

export function mapProductImage(
  record: Omit<CatalogProductImageRecord, "contentType"> & { contentType: string },
) {
  return {
    ...record,
    contentType: record.contentType as CatalogProductImageRecord["contentType"],
  };
}

export function mapOutletProduct(record: PrismaOutletProductRecord): CatalogOutletProductRecord {
  return {
    ...record,
    priceOverrideMinor: record.priceOverrideMinor?.toString() ?? null,
  };
}

export function serializeRecord(record: CatalogChangeRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function writeCatalogChange(
  transaction: TransactionClient,
  options: {
    after: CatalogChangeRecord;
    before?: CatalogChangeRecord;
    context?: CatalogMutationContext;
    entityType:
      | "catalog_category"
      | "catalog_modifier_group"
      | "catalog_modifier_option"
      | "catalog_outlet_product"
      | "catalog_product"
      | "catalog_product_image"
      | "catalog_product_modifier_group"
      | "catalog_product_variant";
    operation: "created" | "updated";
    tenantId: string;
  },
) {
  const payload = {
    after: serializeRecord(options.after),
    ...(options.before ? { before: serializeRecord(options.before) } : {}),
  };
  const action = `${options.entityType}.${options.operation === "created" ? "create" : "update"}`;
  const outletId = "outletId" in options.after ? options.after.outletId : undefined;

  await transaction.auditLog.create({
    data: {
      action,
      ...(options.context?.actorId ? { actorId: options.context.actorId } : {}),
      entityId: options.after.id,
      entityType: options.entityType,
      metadata: buildAuditMetadata(action, payload),
      ...(outletId ? { outletId } : {}),
      ...(options.context?.requestId ? { requestId: options.context.requestId } : {}),
      tenantId: options.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      ...eventOrigin(options.context, "CORE_CATALOG"),
      aggregateId: options.after.id,
      aggregateType: options.entityType,
      payload: safeEventPayload(payload),
      ...(outletId ? { outletId } : {}),
      tenantId: options.tenantId,
      type: `catalog.${options.entityType.slice("catalog_".length)}.${options.operation}`,
    },
  });
}

export async function clearActivePrimaryImages(
  transaction: TransactionClient,
  tenantId: string,
  productId: string,
  context?: CatalogMutationContext,
  exceptId?: string,
) {
  const currentPrimaries = await transaction.catalogProductImage.findMany({
    select: productImageSelect,
    where: {
      ...(exceptId ? { id: { not: exceptId } } : {}),
      isPrimary: true,
      productId,
      status: "ACTIVE",
      tenantId,
    },
  });
  for (const beforeRecord of currentPrimaries) {
    const afterRecord = await transaction.catalogProductImage.update({
      data: { isPrimary: false },
      select: productImageSelect,
      where: { tenantId_id: { id: beforeRecord.id, tenantId } },
    });
    await writeCatalogChange(transaction, {
      after: mapProductImage(afterRecord),
      before: mapProductImage(beforeRecord),
      ...(context ? { context } : {}),
      entityType: "catalog_product_image",
      operation: "updated",
      tenantId,
    });
  }
}
