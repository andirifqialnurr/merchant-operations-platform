import type {
  CreateBrand,
  CreateOutlet,
  CreateTenant,
  OrganizationUnitStatus,
  UpdateBrand,
  UpdateOutlet,
  UpdateTenant,
} from "@merchant/contracts";
import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type MutationContext = {
  actorId?: string;
  requestId?: string;
};

type RecordTimestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export type TenantRecord = RecordTimestamps & {
  id: string;
  name: string;
  slug: string;
  status: OrganizationUnitStatus;
};

export type BrandRecord = RecordTimestamps & {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: OrganizationUnitStatus;
};

export type OutletRecord = RecordTimestamps & {
  id: string;
  tenantId: string;
  brandId: string;
  code: string;
  name: string;
  timezone: string;
  status: OrganizationUnitStatus;
};

export type OrganizationSnapshotRecord = {
  tenant: TenantRecord;
  brands: BrandRecord[];
  outlets: OutletRecord[];
};

export interface OrganizationRepository {
  createBrand(
    tenantId: string,
    input: CreateBrand,
    context?: MutationContext,
  ): Promise<BrandRecord>;
  createOutlet(
    tenantId: string,
    input: CreateOutlet,
    context?: MutationContext,
  ): Promise<OutletRecord>;
  createTenant(input: CreateTenant, context?: MutationContext): Promise<TenantRecord>;
  findBrandById(tenantId: string, brandId: string): Promise<BrandRecord | null>;
  findBrandBySlug(tenantId: string, slug: string): Promise<BrandRecord | null>;
  findOutletByCode(tenantId: string, code: string): Promise<OutletRecord | null>;
  findOutletById(tenantId: string, outletId: string): Promise<OutletRecord | null>;
  findTenantById(tenantId: string): Promise<TenantRecord | null>;
  findTenantBySlug(slug: string): Promise<TenantRecord | null>;
  getSnapshot(tenantId: string): Promise<OrganizationSnapshotRecord | null>;
  updateBrand(
    tenantId: string,
    brandId: string,
    input: UpdateBrand,
    context?: MutationContext,
  ): Promise<BrandRecord>;
  updateOutlet(
    tenantId: string,
    outletId: string,
    input: UpdateOutlet,
    context?: MutationContext,
  ): Promise<OutletRecord>;
  updateTenant(
    tenantId: string,
    input: UpdateTenant,
    context?: MutationContext,
  ): Promise<TenantRecord>;
}

export const ORGANIZATION_REPOSITORY = Symbol("ORGANIZATION_REPOSITORY");

const tenantSelect = {
  createdAt: true,
  id: true,
  name: true,
  slug: true,
  status: true,
  updatedAt: true,
} as const;

const brandSelect = {
  createdAt: true,
  id: true,
  name: true,
  slug: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const outletSelect = {
  brandId: true,
  code: true,
  createdAt: true,
  id: true,
  name: true,
  status: true,
  tenantId: true,
  timezone: true,
  updatedAt: true,
} as const;

type ChangeRecord = TenantRecord | BrandRecord | OutletRecord;
type TransactionClient = Pick<DatabaseClient, "auditLog" | "outboxEvent">;

function serializeRecord(record: ChangeRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function writeChange(
  transaction: TransactionClient,
  options: {
    action: string;
    after: ChangeRecord;
    before?: ChangeRecord;
    context?: MutationContext;
    entityType: "brand" | "outlet" | "tenant";
    outletId?: string;
    tenantId: string;
  },
) {
  const payload = {
    after: serializeRecord(options.after),
    ...(options.before ? { before: serializeRecord(options.before) } : {}),
  };

  await transaction.auditLog.create({
    data: {
      action: options.action,
      ...(options.context?.actorId ? { actorId: options.context.actorId } : {}),
      entityId: options.after.id,
      entityType: options.entityType,
      metadata: payload,
      ...(options.outletId ? { outletId: options.outletId } : {}),
      ...(options.context?.requestId ? { requestId: options.context.requestId } : {}),
      tenantId: options.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      aggregateId: options.after.id,
      aggregateType: options.entityType,
      ...(options.outletId ? { outletId: options.outletId } : {}),
      payload,
      tenantId: options.tenantId,
      type: `organization.${options.entityType}.${options.action.endsWith("create") ? "created" : "updated"}`,
    },
  });
}

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  async findTenantById(tenantId: string) {
    return getPrismaClient().tenant.findUnique({ select: tenantSelect, where: { id: tenantId } });
  }

  async findTenantBySlug(slug: string) {
    return getPrismaClient().tenant.findUnique({ select: tenantSelect, where: { slug } });
  }

  async createTenant(input: CreateTenant, context?: MutationContext) {
    return getPrismaClient().$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: input, select: tenantSelect });
      await writeChange(transaction, {
        action: "tenant.create",
        after: tenant,
        ...(context ? { context } : {}),
        entityType: "tenant",
        tenantId: tenant.id,
      });
      return tenant;
    });
  }

  async updateTenant(tenantId: string, input: UpdateTenant, context?: MutationContext) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.tenant.findUniqueOrThrow({
        select: tenantSelect,
        where: { id: tenantId },
      });
      const tenant = await transaction.tenant.update({
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        select: tenantSelect,
        where: { id: tenantId },
      });
      await writeChange(transaction, {
        action: "tenant.update",
        after: tenant,
        before,
        ...(context ? { context } : {}),
        entityType: "tenant",
        tenantId,
      });
      return tenant;
    });
  }

  async findBrandById(tenantId: string, brandId: string) {
    return getPrismaClient().brand.findUnique({
      select: brandSelect,
      where: { tenantId_id: { id: brandId, tenantId } },
    });
  }

  async findBrandBySlug(tenantId: string, slug: string) {
    return getPrismaClient().brand.findUnique({
      select: brandSelect,
      where: { tenantId_slug: { slug, tenantId } },
    });
  }

  async createBrand(tenantId: string, input: CreateBrand, context?: MutationContext) {
    return getPrismaClient().$transaction(async (transaction) => {
      const brand = await transaction.brand.create({
        data: { ...input, tenantId },
        select: brandSelect,
      });
      await writeChange(transaction, {
        action: "brand.create",
        after: brand,
        ...(context ? { context } : {}),
        entityType: "brand",
        tenantId,
      });
      return brand;
    });
  }

  async updateBrand(
    tenantId: string,
    brandId: string,
    input: UpdateBrand,
    context?: MutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.brand.findUniqueOrThrow({
        select: brandSelect,
        where: { tenantId_id: { id: brandId, tenantId } },
      });
      const brand = await transaction.brand.update({
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        select: brandSelect,
        where: { tenantId_id: { id: brandId, tenantId } },
      });
      await writeChange(transaction, {
        action: "brand.update",
        after: brand,
        before,
        ...(context ? { context } : {}),
        entityType: "brand",
        tenantId,
      });
      return brand;
    });
  }

  async findOutletById(tenantId: string, outletId: string) {
    return getPrismaClient().outlet.findFirst({
      select: outletSelect,
      where: { id: outletId, tenantId },
    });
  }

  async findOutletByCode(tenantId: string, code: string) {
    return getPrismaClient().outlet.findUnique({
      select: outletSelect,
      where: { tenantId_code: { code, tenantId } },
    });
  }

  async createOutlet(tenantId: string, input: CreateOutlet, context?: MutationContext) {
    return getPrismaClient().$transaction(async (transaction) => {
      const outlet = await transaction.outlet.create({
        data: { ...input, tenantId },
        select: outletSelect,
      });
      await writeChange(transaction, {
        action: "outlet.create",
        after: outlet,
        ...(context ? { context } : {}),
        entityType: "outlet",
        outletId: outlet.id,
        tenantId,
      });
      return outlet;
    });
  }

  async updateOutlet(
    tenantId: string,
    outletId: string,
    input: UpdateOutlet,
    context?: MutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.outlet.findFirstOrThrow({
        select: outletSelect,
        where: { id: outletId, tenantId },
      });
      const outlet = await transaction.outlet.update({
        data: {
          ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        },
        select: outletSelect,
        where: { id: outletId },
      });
      await writeChange(transaction, {
        action: "outlet.update",
        after: outlet,
        before,
        ...(context ? { context } : {}),
        entityType: "outlet",
        outletId,
        tenantId,
      });
      return outlet;
    });
  }

  async getSnapshot(tenantId: string) {
    const tenant = await getPrismaClient().tenant.findUnique({
      select: {
        ...tenantSelect,
        brands: { orderBy: { createdAt: "asc" }, select: brandSelect },
        outlets: { orderBy: { createdAt: "asc" }, select: outletSelect },
      },
      where: { id: tenantId },
    });

    if (!tenant) {
      return null;
    }

    const { brands, outlets, ...tenantRecord } = tenant;
    return { brands, outlets, tenant: tenantRecord };
  }
}
