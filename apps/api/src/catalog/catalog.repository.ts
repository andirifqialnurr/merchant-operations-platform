import type {
  CatalogRecordStatus,
  CreateCatalogCategory,
  CreateCatalogProduct,
  OrganizationUnitStatus,
  ProductAvailability,
  UpdateCatalogCategory,
  UpdateCatalogProduct,
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

export type CatalogSnapshotRecord = {
  categories: CatalogCategoryRecord[];
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
  findCategoryById(tenantId: string, categoryId: string): Promise<CatalogCategoryRecord | null>;
  findCategoryBySlug(tenantId: string, slug: string): Promise<CatalogCategoryRecord | null>;
  findProductById(tenantId: string, productId: string): Promise<CatalogProductRecord | null>;
  findProductBySlug(tenantId: string, slug: string): Promise<CatalogProductRecord | null>;
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

type PrismaProductRecord = Omit<CatalogProductRecord, "basePriceMinor"> & {
  basePriceMinor: bigint;
};
type CatalogChangeRecord = CatalogCategoryRecord | CatalogProductRecord;
type TransactionClient = Pick<DatabaseClient, "auditLog" | "outboxEvent">;

function mapProduct(record: PrismaProductRecord): CatalogProductRecord {
  return { ...record, basePriceMinor: record.basePriceMinor.toString() };
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
    entityType: "catalog_category" | "catalog_product";
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
      type: `catalog.${options.entityType === "catalog_category" ? "category" : "product"}.${options.operation}`,
    },
  });
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
      },
      where: { id: tenantId },
    });
    return tenant
      ? {
          categories: tenant.catalogCategories,
          products: tenant.catalogProducts.map(mapProduct),
        }
      : null;
  }
}
