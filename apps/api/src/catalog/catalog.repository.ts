import type {
  CatalogRecordStatus,
  CreateCatalogModifierGroup,
  CreateCatalogModifierOption,
  CreateCatalogCategory,
  CreateCatalogProduct,
  CreateCatalogProductImage,
  CreateCatalogProductModifierGroup,
  CreateCatalogProductVariant,
  ModifierSelectionType,
  OrganizationUnitStatus,
  ProductAvailability,
  UpdateCatalogModifierGroup,
  UpdateCatalogModifierOption,
  UpdateCatalogCategory,
  UpdateCatalogProduct,
  UpdateCatalogProductImage,
  UpdateCatalogProductModifierGroup,
  UpdateCatalogProductVariant,
} from "@merchant/contracts";
import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type CatalogMutationContext = { actorId?: string; requestId?: string };

type RecordTimestamps = { createdAt: Date; updatedAt: Date };

export type CatalogTenantRecord = {
  id: string;
  status: OrganizationUnitStatus;
};

export type CatalogCategoryRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  name: string;
  slug: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductRecord = RecordTimestamps & {
  availability: ProductAvailability;
  basePriceMinor: string;
  categoryId: string;
  currency: string;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductVariantRecord = RecordTimestamps & {
  availability: ProductAvailability;
  displayOrder: number;
  id: string;
  name: string;
  priceDeltaMinor: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogModifierGroupRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  maxSelections: number;
  minSelections: number;
  name: string;
  selectionType: ModifierSelectionType;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogModifierOptionRecord = RecordTimestamps & {
  availability: ProductAvailability;
  displayOrder: number;
  groupId: string;
  id: string;
  name: string;
  priceDeltaMinor: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductModifierGroupRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  modifierGroupId: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductImageRecord = RecordTimestamps & {
  altText: string | null;
  contentType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
  displayOrder: number;
  height: number | null;
  id: string;
  isPrimary: boolean;
  objectKey: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
  width: number | null;
};

export type CatalogSnapshotRecord = {
  categories: CatalogCategoryRecord[];
  modifierGroups: CatalogModifierGroupRecord[];
  modifierOptions: CatalogModifierOptionRecord[];
  productImages: CatalogProductImageRecord[];
  productModifierGroups: CatalogProductModifierGroupRecord[];
  productVariants: CatalogProductVariantRecord[];
  products: CatalogProductRecord[];
};

export interface CatalogRepository {
  createCategory(
    tenantId: string,
    input: CreateCatalogCategory,
    context?: CatalogMutationContext,
  ): Promise<CatalogCategoryRecord>;
  createProduct(
    tenantId: string,
    input: CreateCatalogProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductRecord>;
  createProductVariant(
    tenantId: string,
    input: CreateCatalogProductVariant,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductVariantRecord>;
  createModifierGroup(
    tenantId: string,
    input: CreateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierGroupRecord>;
  createModifierOption(
    tenantId: string,
    input: CreateCatalogModifierOption,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierOptionRecord>;
  createProductModifierGroup(
    tenantId: string,
    input: CreateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductModifierGroupRecord>;
  createProductImage(
    tenantId: string,
    input: CreateCatalogProductImage,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductImageRecord>;
  findCategoryById(tenantId: string, categoryId: string): Promise<CatalogCategoryRecord | null>;
  findCategoryBySlug(tenantId: string, slug: string): Promise<CatalogCategoryRecord | null>;
  findProductById(tenantId: string, productId: string): Promise<CatalogProductRecord | null>;
  findProductBySlug(tenantId: string, slug: string): Promise<CatalogProductRecord | null>;
  findProductVariantById(
    tenantId: string,
    variantId: string,
  ): Promise<CatalogProductVariantRecord | null>;
  findModifierGroupById(
    tenantId: string,
    groupId: string,
  ): Promise<CatalogModifierGroupRecord | null>;
  findModifierGroupByName(
    tenantId: string,
    name: string,
  ): Promise<CatalogModifierGroupRecord | null>;
  findModifierOptionById(
    tenantId: string,
    optionId: string,
  ): Promise<CatalogModifierOptionRecord | null>;
  findModifierOptionByName(
    tenantId: string,
    groupId: string,
    name: string,
  ): Promise<CatalogModifierOptionRecord | null>;
  findProductModifierGroupById(
    tenantId: string,
    assignmentId: string,
  ): Promise<CatalogProductModifierGroupRecord | null>;
  findProductModifierGroup(
    tenantId: string,
    productId: string,
    modifierGroupId: string,
  ): Promise<CatalogProductModifierGroupRecord | null>;
  findProductImageById(
    tenantId: string,
    imageId: string,
  ): Promise<CatalogProductImageRecord | null>;
  findProductImageByObjectKey(
    tenantId: string,
    objectKey: string,
  ): Promise<CatalogProductImageRecord | null>;
  findTenant(tenantId: string): Promise<CatalogTenantRecord | null>;
  getSnapshot(tenantId: string): Promise<CatalogSnapshotRecord | null>;
  updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateCatalogCategory,
    context?: CatalogMutationContext,
  ): Promise<CatalogCategoryRecord>;
  updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateCatalogProduct,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductRecord>;
  updateProductVariant(
    tenantId: string,
    variantId: string,
    input: UpdateCatalogProductVariant,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductVariantRecord>;
  updateModifierGroup(
    tenantId: string,
    groupId: string,
    input: UpdateCatalogModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierGroupRecord>;
  updateModifierOption(
    tenantId: string,
    optionId: string,
    input: UpdateCatalogModifierOption,
    context?: CatalogMutationContext,
  ): Promise<CatalogModifierOptionRecord>;
  updateProductModifierGroup(
    tenantId: string,
    assignmentId: string,
    input: UpdateCatalogProductModifierGroup,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductModifierGroupRecord>;
  updateProductImage(
    tenantId: string,
    imageId: string,
    input: UpdateCatalogProductImage,
    context?: CatalogMutationContext,
  ): Promise<CatalogProductImageRecord>;
}

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");

const categorySelect = {
  createdAt: true,
  displayOrder: true,
  id: true,
  name: true,
  slug: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const productSelect = {
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

const productVariantSelect = {
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

const modifierGroupSelect = {
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

const modifierOptionSelect = {
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

const productModifierGroupSelect = {
  createdAt: true,
  displayOrder: true,
  id: true,
  modifierGroupId: true,
  productId: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const productImageSelect = {
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

type PrismaProductRecord = Omit<CatalogProductRecord, "basePriceMinor"> & {
  basePriceMinor: bigint;
};
type PrismaProductVariantRecord = Omit<CatalogProductVariantRecord, "priceDeltaMinor"> & {
  priceDeltaMinor: bigint;
};
type PrismaModifierOptionRecord = Omit<CatalogModifierOptionRecord, "priceDeltaMinor"> & {
  priceDeltaMinor: bigint;
};
type CatalogChangeRecord =
  | CatalogCategoryRecord
  | CatalogProductRecord
  | CatalogProductVariantRecord
  | CatalogModifierGroupRecord
  | CatalogModifierOptionRecord
  | CatalogProductModifierGroupRecord
  | CatalogProductImageRecord;
type TransactionClient = Pick<DatabaseClient, "auditLog" | "catalogProductImage" | "outboxEvent">;

function mapProduct(record: PrismaProductRecord): CatalogProductRecord {
  return { ...record, basePriceMinor: record.basePriceMinor.toString() };
}

function mapProductVariant(record: PrismaProductVariantRecord): CatalogProductVariantRecord {
  return { ...record, priceDeltaMinor: record.priceDeltaMinor.toString() };
}

function mapModifierOption(record: PrismaModifierOptionRecord): CatalogModifierOptionRecord {
  return { ...record, priceDeltaMinor: record.priceDeltaMinor.toString() };
}

function mapProductImage(
  record: Omit<CatalogProductImageRecord, "contentType"> & { contentType: string },
) {
  return {
    ...record,
    contentType: record.contentType as CatalogProductImageRecord["contentType"],
  };
}

function serializeRecord(record: CatalogChangeRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function writeCatalogChange(
  transaction: TransactionClient,
  options: {
    after: CatalogChangeRecord;
    before?: CatalogChangeRecord;
    context?: CatalogMutationContext;
    entityType:
      | "catalog_category"
      | "catalog_modifier_group"
      | "catalog_modifier_option"
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

  await transaction.auditLog.create({
    data: {
      action,
      ...(options.context?.actorId ? { actorId: options.context.actorId } : {}),
      entityId: options.after.id,
      entityType: options.entityType,
      metadata: payload,
      ...(options.context?.requestId ? { requestId: options.context.requestId } : {}),
      tenantId: options.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      aggregateId: options.after.id,
      aggregateType: options.entityType,
      payload,
      tenantId: options.tenantId,
      type: `catalog.${options.entityType.slice("catalog_".length)}.${options.operation}`,
    },
  });
}

async function clearActivePrimaryImages(
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

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  async findTenant(tenantId: string) {
    return getPrismaClient().tenant.findUnique({
      select: { id: true, status: true },
      where: { id: tenantId },
    });
  }

  async findCategoryById(tenantId: string, categoryId: string) {
    return getPrismaClient().catalogCategory.findUnique({
      select: categorySelect,
      where: { tenantId_id: { id: categoryId, tenantId } },
    });
  }

  async findCategoryBySlug(tenantId: string, slug: string) {
    return getPrismaClient().catalogCategory.findUnique({
      select: categorySelect,
      where: { tenantId_slug: { slug, tenantId } },
    });
  }

  async createCategory(
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

  async updateCategory(
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

  async findProductById(tenantId: string, productId: string) {
    const product = await getPrismaClient().catalogProduct.findUnique({
      select: productSelect,
      where: { tenantId_id: { id: productId, tenantId } },
    });
    return product ? mapProduct(product) : null;
  }

  async findProductBySlug(tenantId: string, slug: string) {
    const product = await getPrismaClient().catalogProduct.findUnique({
      select: productSelect,
      where: { tenantId_slug: { slug, tenantId } },
    });
    return product ? mapProduct(product) : null;
  }

  async createProduct(
    tenantId: string,
    input: CreateCatalogProduct,
    context?: CatalogMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const productRecord = await transaction.catalogProduct.create({
        data: {
          ...input,
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

  async updateProduct(
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
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
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

  async findProductVariantById(tenantId: string, variantId: string) {
    const variant = await getPrismaClient().catalogProductVariant.findUnique({
      select: productVariantSelect,
      where: { tenantId_id: { id: variantId, tenantId } },
    });
    return variant ? mapProductVariant(variant) : null;
  }

  async createProductVariant(
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

  async updateProductVariant(
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

  async findModifierGroupById(tenantId: string, groupId: string) {
    return getPrismaClient().catalogModifierGroup.findUnique({
      select: modifierGroupSelect,
      where: { tenantId_id: { id: groupId, tenantId } },
    });
  }

  async findModifierGroupByName(tenantId: string, name: string) {
    return getPrismaClient().catalogModifierGroup.findUnique({
      select: modifierGroupSelect,
      where: { tenantId_name: { name, tenantId } },
    });
  }

  async createModifierGroup(
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

  async updateModifierGroup(
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

  async findModifierOptionById(tenantId: string, optionId: string) {
    const option = await getPrismaClient().catalogModifierOption.findUnique({
      select: modifierOptionSelect,
      where: { tenantId_id: { id: optionId, tenantId } },
    });
    return option ? mapModifierOption(option) : null;
  }

  async findModifierOptionByName(tenantId: string, groupId: string, name: string) {
    const option = await getPrismaClient().catalogModifierOption.findUnique({
      select: modifierOptionSelect,
      where: { tenantId_groupId_name: { groupId, name, tenantId } },
    });
    return option ? mapModifierOption(option) : null;
  }

  async createModifierOption(
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

  async updateModifierOption(
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

  async findProductModifierGroupById(tenantId: string, assignmentId: string) {
    return getPrismaClient().catalogProductModifierGroup.findUnique({
      select: productModifierGroupSelect,
      where: { tenantId_id: { id: assignmentId, tenantId } },
    });
  }

  async findProductModifierGroup(tenantId: string, productId: string, modifierGroupId: string) {
    return getPrismaClient().catalogProductModifierGroup.findUnique({
      select: productModifierGroupSelect,
      where: { tenantId_productId_modifierGroupId: { modifierGroupId, productId, tenantId } },
    });
  }

  async createProductModifierGroup(
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

  async updateProductModifierGroup(
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

  async findProductImageById(tenantId: string, imageId: string) {
    const image = await getPrismaClient().catalogProductImage.findUnique({
      select: productImageSelect,
      where: { tenantId_id: { id: imageId, tenantId } },
    });
    return image ? mapProductImage(image) : null;
  }

  async findProductImageByObjectKey(tenantId: string, objectKey: string) {
    const image = await getPrismaClient().catalogProductImage.findUnique({
      select: productImageSelect,
      where: { tenantId_objectKey: { objectKey, tenantId } },
    });
    return image ? mapProductImage(image) : null;
  }

  async createProductImage(
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

  async updateProductImage(
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

  async getSnapshot(tenantId: string) {
    const tenant = await getPrismaClient().tenant.findUnique({
      select: {
        id: true,
        catalogCategories: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: categorySelect,
        },
        catalogProducts: {
          orderBy: [{ categoryId: "asc" }, { name: "asc" }],
          select: productSelect,
        },
        catalogProductVariants: {
          orderBy: [{ productId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
          select: productVariantSelect,
        },
        catalogModifierGroups: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: modifierGroupSelect,
        },
        catalogModifierOptions: {
          orderBy: [{ groupId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
          select: modifierOptionSelect,
        },
        catalogProductModifierGroups: {
          orderBy: [{ productId: "asc" }, { displayOrder: "asc" }],
          select: productModifierGroupSelect,
        },
        catalogProductImages: {
          orderBy: [{ productId: "asc" }, { displayOrder: "asc" }],
          select: productImageSelect,
        },
      },
      where: { id: tenantId },
    });
    return tenant
      ? {
          categories: tenant.catalogCategories,
          modifierGroups: tenant.catalogModifierGroups,
          modifierOptions: tenant.catalogModifierOptions.map(mapModifierOption),
          productImages: tenant.catalogProductImages.map(mapProductImage),
          productModifierGroups: tenant.catalogProductModifierGroups,
          productVariants: tenant.catalogProductVariants.map(mapProductVariant),
          products: tenant.catalogProducts.map(mapProduct),
        }
      : null;
  }
}
