import {
  brandSchema,
  createBrandSchema,
  createOutletSchema,
  createTenantSchema,
  organizationSnapshotSchema,
  outletSchema,
  tenantSchema,
  updateBrandSchema,
  updateOutletSchema,
  updateTenantSchema,
  type Brand,
  type CreateBrand,
  type CreateOutlet,
  type CreateTenant,
  type OrganizationSnapshot,
  type Outlet,
  type Tenant,
  type UpdateBrand,
  type UpdateOutlet,
  type UpdateTenant,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  ORGANIZATION_REPOSITORY,
  type BrandRecord,
  type MutationContext,
  type OrganizationRepository,
  type OrganizationSnapshotRecord,
  type OutletRecord,
  type TenantRecord,
} from "./organization.repository.js";

function notFound(code: string, message: string) {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function toTenant(record: TenantRecord): Tenant {
  return tenantSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toBrand(record: BrandRecord): Brand {
  return brandSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toOutlet(record: OutletRecord): Outlet {
  return outletSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toSnapshot(record: OrganizationSnapshotRecord): OrganizationSnapshot {
  return organizationSnapshotSchema.parse({
    brands: record.brands.map(toBrand),
    outlets: record.outlets.map(toOutlet),
    tenant: toTenant(record.tenant),
  });
}

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: OrganizationRepository,
  ) {}

  private async requireTenant(tenantId: string) {
    const tenant = await this.repository.findTenantById(tenantId);

    if (!tenant) {
      throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    }

    return tenant;
  }

  private async requireActiveTenant(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);

    if (tenant.status !== "ACTIVE") {
      throw conflict("TENANT_INACTIVE", "Tenant tidak aktif.");
    }

    return tenant;
  }

  private async requireBrand(tenantId: string, brandId: string) {
    const brand = await this.repository.findBrandById(tenantId, brandId);

    if (!brand) {
      throw notFound("BRAND_NOT_FOUND", "Brand tidak ditemukan pada tenant ini.");
    }

    return brand;
  }

  private async requireActiveBrand(tenantId: string, brandId: string) {
    const brand = await this.requireBrand(tenantId, brandId);

    if (brand.status !== "ACTIVE") {
      throw conflict("BRAND_INACTIVE", "Brand tidak aktif.");
    }

    return brand;
  }

  private async runUniqueMutation<T>(operation: () => Promise<T>, code: string, message: string) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict(code, message);
      }

      throw error;
    }
  }

  async createTenant(input: CreateTenant, context?: MutationContext) {
    const parsed = createTenantSchema.parse(input);

    if (await this.repository.findTenantBySlug(parsed.slug)) {
      throw conflict("TENANT_SLUG_CONFLICT", "Slug tenant sudah digunakan.");
    }

    const tenant = await this.runUniqueMutation(
      () => this.repository.createTenant(parsed, context),
      "TENANT_SLUG_CONFLICT",
      "Slug tenant sudah digunakan.",
    );
    return toTenant(tenant);
  }

  async updateTenant(tenantId: string, input: UpdateTenant, context?: MutationContext) {
    const current = await this.requireTenant(tenantId);
    const parsed = updateTenantSchema.parse(input);

    if (parsed.slug && parsed.slug !== current.slug) {
      const duplicate = await this.repository.findTenantBySlug(parsed.slug);

      if (duplicate && duplicate.id !== tenantId) {
        throw conflict("TENANT_SLUG_CONFLICT", "Slug tenant sudah digunakan.");
      }
    }

    const tenant = await this.runUniqueMutation(
      () => this.repository.updateTenant(tenantId, parsed, context),
      "TENANT_SLUG_CONFLICT",
      "Slug tenant sudah digunakan.",
    );
    return toTenant(tenant);
  }

  async createBrand(tenantId: string, input: CreateBrand, context?: MutationContext) {
    await this.requireActiveTenant(tenantId);
    const parsed = createBrandSchema.parse(input);

    if (await this.repository.findBrandBySlug(tenantId, parsed.slug)) {
      throw conflict("BRAND_SLUG_CONFLICT", "Slug brand sudah digunakan pada tenant ini.");
    }

    const brand = await this.runUniqueMutation(
      () => this.repository.createBrand(tenantId, parsed, context),
      "BRAND_SLUG_CONFLICT",
      "Slug brand sudah digunakan pada tenant ini.",
    );
    return toBrand(brand);
  }

  async updateBrand(
    tenantId: string,
    brandId: string,
    input: UpdateBrand,
    context?: MutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.requireBrand(tenantId, brandId);
    const parsed = updateBrandSchema.parse(input);

    if (parsed.slug && parsed.slug !== current.slug) {
      const duplicate = await this.repository.findBrandBySlug(tenantId, parsed.slug);

      if (duplicate && duplicate.id !== brandId) {
        throw conflict("BRAND_SLUG_CONFLICT", "Slug brand sudah digunakan pada tenant ini.");
      }
    }

    const brand = await this.runUniqueMutation(
      () => this.repository.updateBrand(tenantId, brandId, parsed, context),
      "BRAND_SLUG_CONFLICT",
      "Slug brand sudah digunakan pada tenant ini.",
    );
    return toBrand(brand);
  }

  async createOutlet(tenantId: string, input: CreateOutlet, context?: MutationContext) {
    await this.requireActiveTenant(tenantId);
    const parsed = createOutletSchema.parse(input);
    await this.requireActiveBrand(tenantId, parsed.brandId);

    if (await this.repository.findOutletByCode(tenantId, parsed.code)) {
      throw conflict("OUTLET_CODE_CONFLICT", "Kode outlet sudah digunakan pada tenant ini.");
    }

    const outlet = await this.runUniqueMutation(
      () => this.repository.createOutlet(tenantId, parsed, context),
      "OUTLET_CODE_CONFLICT",
      "Kode outlet sudah digunakan pada tenant ini.",
    );
    return toOutlet(outlet);
  }

  async updateOutlet(
    tenantId: string,
    outletId: string,
    input: UpdateOutlet,
    context?: MutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findOutletById(tenantId, outletId);

    if (!current) {
      throw notFound("OUTLET_NOT_FOUND", "Outlet tidak ditemukan pada tenant ini.");
    }

    const parsed = updateOutletSchema.parse(input);
    await this.requireActiveBrand(tenantId, parsed.brandId ?? current.brandId);

    if (parsed.code && parsed.code !== current.code) {
      const duplicate = await this.repository.findOutletByCode(tenantId, parsed.code);

      if (duplicate && duplicate.id !== outletId) {
        throw conflict("OUTLET_CODE_CONFLICT", "Kode outlet sudah digunakan pada tenant ini.");
      }
    }

    const outlet = await this.runUniqueMutation(
      () => this.repository.updateOutlet(tenantId, outletId, parsed, context),
      "OUTLET_CODE_CONFLICT",
      "Kode outlet sudah digunakan pada tenant ini.",
    );
    return toOutlet(outlet);
  }

  async getSnapshot(tenantId: string) {
    const snapshot = await this.repository.getSnapshot(tenantId);

    if (!snapshot) {
      throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    }

    return toSnapshot(snapshot);
  }
}
