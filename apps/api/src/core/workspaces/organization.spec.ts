import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import type {
  BrandRecord,
  OrganizationRepository,
  OutletRecord,
  TenantRecord,
} from "./organization.repository.js";
import { OrganizationService } from "./organization.service.js";

const IDS = {
  brandA: "019f738d-e61f-7d46-92de-17b35f970b92",
  brandB: "019f738d-e61f-7d46-92de-17b35f970b95",
  outletA: "019f738d-e61f-7d46-92de-17b35f970b93",
  outletB: "019f738d-e61f-7d46-92de-17b35f970b96",
  tenantA: "019f738d-e61f-7d46-92de-17b35f970b91",
  tenantB: "019f738d-e61f-7d46-92de-17b35f970b94",
} as const;

class InMemoryOrganizationRepository implements OrganizationRepository {
  readonly brands: BrandRecord[] = [];
  readonly outlets: OutletRecord[] = [];
  readonly tenants: TenantRecord[] = [];

  private now() {
    return new Date("2026-07-18T04:00:00.000Z");
  }

  private nextId(kind: "brand" | "outlet" | "tenant") {
    if (kind === "tenant") {
      return this.tenants.length === 0 ? IDS.tenantA : IDS.tenantB;
    }

    if (kind === "brand") {
      return this.brands.length === 0 ? IDS.brandA : IDS.brandB;
    }

    return this.outlets.length === 0 ? IDS.outletA : IDS.outletB;
  }

  async findTenantById(tenantId: string) {
    return this.tenants.find((tenant) => tenant.id === tenantId) ?? null;
  }

  async findTenantBySlug(slug: string) {
    return this.tenants.find((tenant) => tenant.slug === slug) ?? null;
  }

  async createTenant(input: { name: string; slug: string }) {
    const timestamp = this.now();
    const tenant: TenantRecord = {
      ...input,
      createdAt: timestamp,
      currency: "IDR",
      id: this.nextId("tenant"),
      status: "ACTIVE",
      updatedAt: timestamp,
    };
    this.tenants.push(tenant);
    return tenant;
  }

  async updateTenant(
    tenantId: string,
    input: Partial<Pick<TenantRecord, "name" | "slug" | "status">>,
  ) {
    const tenant = this.tenants.find((candidate) => candidate.id === tenantId);
    assert.ok(tenant);
    Object.assign(tenant, input, { updatedAt: this.now() });
    return tenant;
  }

  async findBrandById(tenantId: string, brandId: string) {
    return this.brands.find((brand) => brand.id === brandId && brand.tenantId === tenantId) ?? null;
  }

  async findBrandBySlug(tenantId: string, slug: string) {
    return this.brands.find((brand) => brand.slug === slug && brand.tenantId === tenantId) ?? null;
  }

  async createBrand(tenantId: string, input: { name: string; slug: string }) {
    const timestamp = this.now();
    const brand: BrandRecord = {
      ...input,
      createdAt: timestamp,
      id: this.nextId("brand"),
      status: "ACTIVE",
      tenantId,
      updatedAt: timestamp,
    };
    this.brands.push(brand);
    return brand;
  }

  async updateBrand(
    tenantId: string,
    brandId: string,
    input: Partial<Pick<BrandRecord, "name" | "slug" | "status">>,
  ) {
    const brand = this.brands.find(
      (candidate) => candidate.id === brandId && candidate.tenantId === tenantId,
    );
    assert.ok(brand);
    Object.assign(brand, input, { updatedAt: this.now() });
    return brand;
  }

  async findOutletById(tenantId: string, outletId: string) {
    return (
      this.outlets.find((outlet) => outlet.id === outletId && outlet.tenantId === tenantId) ?? null
    );
  }

  async findOutletByCode(tenantId: string, code: string) {
    return (
      this.outlets.find((outlet) => outlet.code === code && outlet.tenantId === tenantId) ?? null
    );
  }

  async createOutlet(
    tenantId: string,
    input: { address?: string; brandId: string; code: string; name: string; timezone: string },
  ) {
    const timestamp = this.now();
    const outlet: OutletRecord = {
      address: null,
      ...input,
      createdAt: timestamp,
      id: this.nextId("outlet"),
      status: "ACTIVE",
      tenantId,
      updatedAt: timestamp,
    };
    this.outlets.push(outlet);
    return outlet;
  }

  async updateOutlet(
    tenantId: string,
    outletId: string,
    input: Partial<
      Pick<OutletRecord, "address" | "brandId" | "code" | "name" | "status" | "timezone">
    >,
  ) {
    const outlet = this.outlets.find(
      (candidate) => candidate.id === outletId && candidate.tenantId === tenantId,
    );
    assert.ok(outlet);
    Object.assign(outlet, input, { updatedAt: this.now() });
    return outlet;
  }

  async getSnapshot(tenantId: string) {
    const tenant = await this.findTenantById(tenantId);

    return tenant
      ? {
          brands: this.brands.filter((brand) => brand.tenantId === tenantId),
          outlets: this.outlets.filter((outlet) => outlet.tenantId === tenantId),
          tenant,
        }
      : null;
  }
}

function responseCode(error: unknown) {
  if (!(error instanceof ConflictException || error instanceof NotFoundException)) {
    return undefined;
  }

  const response = error.getResponse();
  return typeof response === "object" && response !== null && "code" in response
    ? response.code
    : undefined;
}

test("creates a normalized tenant hierarchy and returns a scoped snapshot", async () => {
  const repository = new InMemoryOrganizationRepository();
  const service = new OrganizationService(repository);
  const tenant = await service.createTenant({ name: " Kopi Nusantara ", slug: "Kopi-Nusantara" });
  const brand = await service.createBrand(tenant.id, { name: "Kopi Kita", slug: "kopi-kita" });
  const outlet = await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: " bdg-01 ",
    name: "Bandung Utama",
    timezone: "Asia/Jakarta",
  });
  const snapshot = await service.getSnapshot(tenant.id);

  assert.equal(tenant.slug, "kopi-nusantara");
  assert.equal(outlet.code, "BDG-01");
  assert.equal(snapshot.brands.length, 1);
  assert.equal(snapshot.outlets.length, 1);
});

test("rejects a brand from another tenant when creating an outlet", async () => {
  const repository = new InMemoryOrganizationRepository();
  const service = new OrganizationService(repository);
  const tenantA = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const tenantB = await service.createTenant({ name: "Tenant B", slug: "tenant-b" });
  const brandB = await service.createBrand(tenantB.id, { name: "Brand B", slug: "brand-b" });

  await assert.rejects(
    () =>
      service.createOutlet(tenantA.id, {
        brandId: brandB.id,
        code: "A-01",
        name: "Outlet A",
        timezone: "Asia/Jakarta",
      }),
    (error: unknown) => responseCode(error) === "BRAND_NOT_FOUND",
  );
});

test("rejects duplicate outlet codes and writes no second outlet", async () => {
  const repository = new InMemoryOrganizationRepository();
  const service = new OrganizationService(repository);
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const input = {
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  };

  await service.createOutlet(tenant.id, input);
  await assert.rejects(
    () => service.createOutlet(tenant.id, { ...input, name: "Outlet Duplikat" }),
    (error: unknown) => responseCode(error) === "OUTLET_CODE_CONFLICT",
  );
  assert.equal(repository.outlets.length, 1);
});

test("prevents new organization units below an inactive tenant", async () => {
  const repository = new InMemoryOrganizationRepository();
  const service = new OrganizationService(repository);
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  await service.updateTenant(tenant.id, { status: "INACTIVE" });

  await assert.rejects(
    () => service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" }),
    (error: unknown) => responseCode(error) === "TENANT_INACTIVE",
  );
});

test("returns only brands and outlets owned by the requested tenant", async () => {
  const repository = new InMemoryOrganizationRepository();
  const service = new OrganizationService(repository);
  const tenantA = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const tenantB = await service.createTenant({ name: "Tenant B", slug: "tenant-b" });
  const brandA = await service.createBrand(tenantA.id, { name: "Brand A", slug: "brand-a" });
  const brandB = await service.createBrand(tenantB.id, { name: "Brand B", slug: "brand-b" });
  const outletA = await service.createOutlet(tenantA.id, {
    brandId: brandA.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });
  const outletB = await service.createOutlet(tenantB.id, {
    brandId: brandB.id,
    code: "B-01",
    name: "Outlet B",
    timezone: "Asia/Jakarta",
  });

  const snapshotA = await service.getSnapshot(tenantA.id);
  const snapshotB = await service.getSnapshot(tenantB.id);

  assert.deepEqual(
    snapshotA.brands.map((brand) => brand.id),
    [brandA.id],
  );
  assert.deepEqual(
    snapshotA.outlets.map((outlet) => outlet.id),
    [outletA.id],
  );
  assert.deepEqual(
    snapshotB.brands.map((brand) => brand.id),
    [brandB.id],
  );
  assert.deepEqual(
    snapshotB.outlets.map((outlet) => outlet.id),
    [outletB.id],
  );
});

test("asks the limit gate before a brand or an outlet is created", async () => {
  const repository = new InMemoryOrganizationRepository();
  const asked: string[] = [];
  let full = false;
  const service = new OrganizationService(repository, {
    assertCanAdd: async (_tenantId, dimensionKey) => {
      asked.push(dimensionKey);
      if (full) throw new Error("LIMIT_REACHED");
    },
  });
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const outlet = { brandId: brand.id, code: "A-01", name: "Outlet A", timezone: "Asia/Jakarta" };
  await service.createOutlet(tenant.id, outlet);
  full = true;
  await assert.rejects(
    () => service.createOutlet(tenant.id, { ...outlet, code: "A-02" }),
    /LIMIT_REACHED/,
  );
  await assert.rejects(
    () => service.createBrand(tenant.id, { name: "Brand B", slug: "brand-b" }),
    /LIMIT_REACHED/,
  );

  assert.deepEqual(asked, [
    "core.business_units.active",
    "core.locations.active",
    "core.locations.active",
    "core.business_units.active",
  ]);
  const snapshot = await service.getSnapshot(tenant.id);
  assert.deepEqual([snapshot.brands.length, snapshot.outlets.length], [1, 1]);
});

test("an outlet keeps its address and time zone, and the address can be removed", async () => {
  const service = new OrganizationService(new InMemoryOrganizationRepository());
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const outlet = await service.createOutlet(tenant.id, {
    address: "  Jl. Merdeka No. 1, Bandung  ",
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });
  assert.equal(outlet.address, "Jl. Merdeka No. 1, Bandung");

  const moved = await service.updateOutlet(tenant.id, outlet.id, {
    address: "Jl. Sudirman No. 9, Makassar",
    timezone: "Asia/Makassar",
  });
  assert.deepEqual(
    [moved.address, moved.timezone],
    ["Jl. Sudirman No. 9, Makassar", "Asia/Makassar"],
  );

  const cleared = await service.updateOutlet(tenant.id, outlet.id, { address: null });
  assert.equal(cleared.address, null);
  // The currency of the business is read, never sent with a change.
  assert.equal((await service.getSnapshot(tenant.id)).tenant.currency, "IDR");
});

test("a brand with active outlets stays active and outlet reactivation checks its limit", async () => {
  let full = false;
  const service = new OrganizationService(new InMemoryOrganizationRepository(), {
    assertCanAdd: async () => {
      if (full) throw new Error("LIMIT_REACHED");
    },
  });
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });

  await assert.rejects(
    () => service.updateBrand(tenant.id, brand.id, { status: "INACTIVE" }),
    (error) => responseCode(error) === "BRAND_HAS_ACTIVE_OUTLETS",
  );

  const second = await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: "A-02",
    name: "Outlet B",
    timezone: "Asia/Jakarta",
  });
  const closed = await service.updateOutlet(tenant.id, second.id, { status: "INACTIVE" });
  assert.equal(closed.status, "INACTIVE");

  // Coming back counts against the limit like a new outlet.
  full = true;
  await assert.rejects(
    () => service.updateOutlet(tenant.id, second.id, { status: "ACTIVE" }),
    /LIMIT_REACHED/,
  );
  // Renaming an inactive outlet is not coming back.
  const renamed = await service.updateOutlet(tenant.id, second.id, { name: "Outlet B2" });
  assert.equal(renamed.name, "Outlet B2");
});

test("a workspace can have no active outlets without losing its records", async () => {
  const service = new OrganizationService(new InMemoryOrganizationRepository());
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const outlet = await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });
  await service.updateOutlet(tenant.id, outlet.id, { status: "INACTIVE" });
  await service.updateBrand(tenant.id, brand.id, { status: "INACTIVE" });
  const snapshot = await service.getSnapshot(tenant.id);
  assert.equal(snapshot.outlets.length, 1);
  assert.equal(snapshot.outlets[0]?.status, "INACTIVE");
  assert.equal(snapshot.brands[0]?.status, "INACTIVE");
});

test("reactivating a brand checks its limit without blocking edits to inactive outlets", async () => {
  let full = false;
  const asked: string[] = [];
  const service = new OrganizationService(new InMemoryOrganizationRepository(), {
    assertCanAdd: async (_tenantId, dimensionKey) => {
      asked.push(dimensionKey);
      if (full) throw new Error("LIMIT_REACHED");
    },
  });
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const other = await service.createBrand(tenant.id, { name: "Brand B", slug: "brand-b" });
  const outlet = await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });
  await service.createOutlet(tenant.id, {
    brandId: other.id,
    code: "B-01",
    name: "Outlet B",
    timezone: "Asia/Jakarta",
  });
  await service.updateOutlet(tenant.id, outlet.id, { status: "INACTIVE" });
  await service.updateBrand(tenant.id, brand.id, { status: "INACTIVE" });
  full = true;
  const renamed = await service.updateOutlet(tenant.id, outlet.id, {
    brandId: brand.id,
    name: "Outlet A2",
  });
  assert.equal(renamed.name, "Outlet A2");
  assert.equal(renamed.status, "INACTIVE");
  await assert.rejects(
    () => service.updateOutlet(tenant.id, outlet.id, { status: "ACTIVE" }),
    (error) => responseCode(error) === "BRAND_INACTIVE",
  );
  await assert.rejects(
    () => service.updateBrand(tenant.id, brand.id, { status: "ACTIVE" }),
    /LIMIT_REACHED/,
  );
  assert.equal(asked.at(-1), "core.business_units.active");
  assert.equal((await service.getSnapshot(tenant.id)).brands[0]?.status, "INACTIVE");
});

test("moving an inactive outlet still requires an active brand in the same tenant", async () => {
  const service = new OrganizationService(new InMemoryOrganizationRepository());
  const tenant = await service.createTenant({ name: "Tenant A", slug: "tenant-a" });
  const brand = await service.createBrand(tenant.id, { name: "Brand A", slug: "brand-a" });
  const other = await service.createBrand(tenant.id, { name: "Brand B", slug: "brand-b" });
  const outlet = await service.createOutlet(tenant.id, {
    brandId: brand.id,
    code: "A-01",
    name: "Outlet A",
    timezone: "Asia/Jakarta",
  });
  await service.updateOutlet(tenant.id, outlet.id, { status: "INACTIVE" });
  await service.updateBrand(tenant.id, other.id, { status: "INACTIVE" });
  await assert.rejects(
    () => service.updateOutlet(tenant.id, outlet.id, { brandId: other.id }),
    (error) => responseCode(error) === "BRAND_INACTIVE",
  );
  await assert.rejects(
    () => service.updateOutlet(tenant.id, outlet.id, { brandId: IDS.tenantB }),
    (error) => responseCode(error) === "BRAND_NOT_FOUND",
  );
  await service.updateBrand(tenant.id, other.id, { status: "ACTIVE" });
  const moved = await service.updateOutlet(tenant.id, outlet.id, { brandId: other.id });
  assert.equal(moved.brandId, other.id);
  assert.equal(moved.status, "INACTIVE");
});
