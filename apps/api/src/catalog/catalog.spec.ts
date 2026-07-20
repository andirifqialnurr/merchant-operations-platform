import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  type CatalogCategoryRecord,
  type CatalogMutationContext,
  type CatalogProductRecord,
  type CatalogRepository,
  type CatalogTenantRecord,
} from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

const TENANT_A = "019f738d-e61f-7d46-92de-17b35f971101";
const TENANT_B = "019f738d-e61f-7d46-92de-17b35f971102";
const TENANT_INACTIVE = "019f738d-e61f-7d46-92de-17b35f971103";
const ACTOR_ID = "019f738d-e61f-7d46-92de-17b35f971104";

class InMemoryCatalogRepository implements CatalogRepository {
  private readonly tenants = new Map<string, CatalogTenantRecord>([
    [TENANT_A, { id: TENANT_A, status: "ACTIVE" }],
    [TENANT_B, { id: TENANT_B, status: "ACTIVE" }],
    [TENANT_INACTIVE, { id: TENANT_INACTIVE, status: "INACTIVE" }],
  ]);
  private readonly categories = new Map<string, CatalogCategoryRecord>();
  private readonly products = new Map<string, CatalogProductRecord>();
  readonly mutationContexts: Array<CatalogMutationContext | undefined> = [];

  private key(tenantId: string, id: string) {
    return `${tenantId}:${id}`;
  }

  async findTenant(tenantId: string) {
    return this.tenants.get(tenantId) ?? null;
  }

  async findCategoryById(tenantId: string, categoryId: string) {
    return this.categories.get(this.key(tenantId, categoryId)) ?? null;
  }

  async findCategoryBySlug(tenantId: string, slug: string) {
    return (
      [...this.categories.values()].find(
        (category) => category.tenantId === tenantId && category.slug === slug,
      ) ?? null
    );
  }

  async createCategory(
    tenantId: string,
    input: Parameters<CatalogRepository["createCategory"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const category: CatalogCategoryRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.categories.set(this.key(tenantId, category.id), category);
    this.mutationContexts.push(context);
    return category;
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: Parameters<CatalogRepository["updateCategory"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.categories.get(this.key(tenantId, categoryId));
    assert.ok(current);
    const category: CatalogCategoryRecord = {
      ...current,
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.categories.set(this.key(tenantId, categoryId), category);
    this.mutationContexts.push(context);
    return category;
  }

  async findProductById(tenantId: string, productId: string) {
    return this.products.get(this.key(tenantId, productId)) ?? null;
  }

  async findProductBySlug(tenantId: string, slug: string) {
    return (
      [...this.products.values()].find(
        (product) => product.tenantId === tenantId && product.slug === slug,
      ) ?? null
    );
  }

  async createProduct(
    tenantId: string,
    input: Parameters<CatalogRepository["createProduct"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const product: CatalogProductRecord = {
      ...input,
      createdAt: now,
      description: input.description ?? null,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.products.set(this.key(tenantId, product.id), product);
    this.mutationContexts.push(context);
    return product;
  }

  async updateProduct(
    tenantId: string,
    productId: string,
    input: Parameters<CatalogRepository["updateProduct"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.products.get(this.key(tenantId, productId));
    assert.ok(current);
    const product: CatalogProductRecord = {
      ...current,
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.basePriceMinor !== undefined ? { basePriceMinor: input.basePriceMinor } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.products.set(this.key(tenantId, productId), product);
    this.mutationContexts.push(context);
    return product;
  }

  async getSnapshot(tenantId: string) {
    if (!this.tenants.has(tenantId)) return null;
    return {
      categories: [...this.categories.values()].filter((item) => item.tenantId === tenantId),
      products: [...this.products.values()].filter((item) => item.tenantId === tenantId),
    };
  }
}

async function createCategory(service: CatalogService, tenantId: string, slug = "kopi") {
  return service.createCategory(tenantId, {
    displayOrder: 0,
    name: slug === "kopi" ? "Kopi" : "Makanan",
    slug,
  });
}

test("creates category and product master with exact minor-unit price", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const category = await service.createCategory(
    TENANT_A,
    { displayOrder: 1, name: "Minuman Kopi", slug: "minuman-kopi" },
    { actorId: ACTOR_ID, requestId: "req_catalog_create" },
  );
  const product = await service.createProduct(TENANT_A, {
    availability: "AVAILABLE",
    basePriceMinor: "25000",
    categoryId: category.id,
    currency: "IDR",
    description: "Espresso dengan susu segar",
    name: "Kopi Susu",
    slug: "kopi-susu",
  });

  assert.equal(product.basePriceMinor, "25000");
  assert.equal(product.availability, "AVAILABLE");
  assert.deepEqual(repository.mutationContexts[0], {
    actorId: ACTOR_ID,
    requestId: "req_catalog_create",
  });
  assert.equal((await service.getSnapshot(TENANT_A)).products[0]?.id, product.id);
});

test("updates sold-out state and base price without deleting the product", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const category = await createCategory(service, TENANT_A);
  const product = await service.createProduct(TENANT_A, {
    availability: "AVAILABLE",
    basePriceMinor: "18000",
    categoryId: category.id,
    currency: "IDR",
    name: "Americano",
    slug: "americano",
  });

  const updated = await service.updateProduct(TENANT_A, product.id, {
    availability: "SOLD_OUT",
    basePriceMinor: "20000",
  });
  assert.equal(updated.availability, "SOLD_OUT");
  assert.equal(updated.basePriceMinor, "20000");
  assert.equal((await service.getSnapshot(TENANT_A)).products.length, 1);
});

test("rejects cross-tenant categories while allowing the same slug per tenant", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const categoryA = await createCategory(service, TENANT_A);
  await createCategory(service, TENANT_B);

  await assert.rejects(
    () =>
      service.createProduct(TENANT_B, {
        availability: "AVAILABLE",
        basePriceMinor: "10000",
        categoryId: categoryA.id,
        currency: "IDR",
        name: "Produk Silang",
        slug: "produk-silang",
      }),
    NotFoundException,
  );
  await assert.rejects(() => createCategory(service, TENANT_A), ConflictException);
  assert.equal((await service.getSnapshot(TENANT_A)).categories.length, 1);
  assert.equal((await service.getSnapshot(TENANT_B)).categories.length, 1);
});

test("blocks mutations below inactive tenants and inactive categories", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  await assert.rejects(
    () => createCategory(service, TENANT_INACTIVE),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );

  const category = await createCategory(service, TENANT_A);
  await service.updateCategory(TENANT_A, category.id, { status: "INACTIVE" });
  await assert.rejects(
    () =>
      service.createProduct(TENANT_A, {
        availability: "AVAILABLE",
        basePriceMinor: "12000",
        categoryId: category.id,
        currency: "IDR",
        name: "Produk Nonaktif",
        slug: "produk-nonaktif",
      }),
    ConflictException,
  );
});
