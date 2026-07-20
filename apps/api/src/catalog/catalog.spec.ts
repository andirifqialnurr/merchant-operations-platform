import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  type CatalogCategoryRecord,
  type CatalogModifierGroupRecord,
  type CatalogModifierOptionRecord,
  type CatalogMutationContext,
  type CatalogOutletProductRecord,
  type CatalogProductRecord,
  type CatalogProductImageRecord,
  type CatalogProductModifierGroupRecord,
  type CatalogProductVariantRecord,
  type CatalogRepository,
  type CatalogTenantRecord,
} from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

const TENANT_A = "019f738d-e61f-7d46-92de-17b35f971101";
const TENANT_B = "019f738d-e61f-7d46-92de-17b35f971102";
const TENANT_INACTIVE = "019f738d-e61f-7d46-92de-17b35f971103";
const ACTOR_ID = "019f738d-e61f-7d46-92de-17b35f971104";
const OUTLET_A = "019f738d-e61f-7d46-92de-17b35f971105";
const OUTLET_B = "019f738d-e61f-7d46-92de-17b35f971106";
const OUTLET_INACTIVE = "019f738d-e61f-7d46-92de-17b35f971107";

class InMemoryCatalogRepository implements CatalogRepository {
  private readonly tenants = new Map<string, CatalogTenantRecord>([
    [TENANT_A, { id: TENANT_A, status: "ACTIVE" }],
    [TENANT_B, { id: TENANT_B, status: "ACTIVE" }],
    [TENANT_INACTIVE, { id: TENANT_INACTIVE, status: "INACTIVE" }],
  ]);
  private readonly outlets = new Map([
    [OUTLET_A, { id: OUTLET_A, status: "ACTIVE" as const, tenantId: TENANT_A }],
    [OUTLET_B, { id: OUTLET_B, status: "ACTIVE" as const, tenantId: TENANT_B }],
    [OUTLET_INACTIVE, { id: OUTLET_INACTIVE, status: "INACTIVE" as const, tenantId: TENANT_A }],
  ]);
  private readonly categories = new Map<string, CatalogCategoryRecord>();
  private readonly products = new Map<string, CatalogProductRecord>();
  private readonly productVariants = new Map<string, CatalogProductVariantRecord>();
  private readonly modifierGroups = new Map<string, CatalogModifierGroupRecord>();
  private readonly modifierOptions = new Map<string, CatalogModifierOptionRecord>();
  private readonly productModifierGroups = new Map<string, CatalogProductModifierGroupRecord>();
  private readonly productImages = new Map<string, CatalogProductImageRecord>();
  private readonly outletProducts = new Map<string, CatalogOutletProductRecord>();
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

  async findProductVariantById(tenantId: string, variantId: string) {
    return this.productVariants.get(this.key(tenantId, variantId)) ?? null;
  }

  async createProductVariant(
    tenantId: string,
    input: Parameters<CatalogRepository["createProductVariant"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const variant: CatalogProductVariantRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.productVariants.set(this.key(tenantId, variant.id), variant);
    this.mutationContexts.push(context);
    return variant;
  }

  async updateProductVariant(
    tenantId: string,
    variantId: string,
    input: Parameters<CatalogRepository["updateProductVariant"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.productVariants.get(this.key(tenantId, variantId));
    assert.ok(current);
    const variant: CatalogProductVariantRecord = {
      ...current,
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.priceDeltaMinor !== undefined ? { priceDeltaMinor: input.priceDeltaMinor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.productVariants.set(this.key(tenantId, variantId), variant);
    this.mutationContexts.push(context);
    return variant;
  }

  async findModifierGroupById(tenantId: string, groupId: string) {
    return this.modifierGroups.get(this.key(tenantId, groupId)) ?? null;
  }

  async findModifierGroupByName(tenantId: string, name: string) {
    return (
      [...this.modifierGroups.values()].find(
        (group) => group.tenantId === tenantId && group.name === name,
      ) ?? null
    );
  }

  async createModifierGroup(
    tenantId: string,
    input: Parameters<CatalogRepository["createModifierGroup"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const group: CatalogModifierGroupRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.modifierGroups.set(this.key(tenantId, group.id), group);
    this.mutationContexts.push(context);
    return group;
  }

  async updateModifierGroup(
    tenantId: string,
    groupId: string,
    input: Parameters<CatalogRepository["updateModifierGroup"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.modifierGroups.get(this.key(tenantId, groupId));
    assert.ok(current);
    const group: CatalogModifierGroupRecord = {
      ...current,
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.maxSelections !== undefined ? { maxSelections: input.maxSelections } : {}),
      ...(input.minSelections !== undefined ? { minSelections: input.minSelections } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.selectionType !== undefined ? { selectionType: input.selectionType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.modifierGroups.set(this.key(tenantId, groupId), group);
    this.mutationContexts.push(context);
    return group;
  }

  async findModifierOptionById(tenantId: string, optionId: string) {
    return this.modifierOptions.get(this.key(tenantId, optionId)) ?? null;
  }

  async findModifierOptionByName(tenantId: string, groupId: string, name: string) {
    return (
      [...this.modifierOptions.values()].find(
        (option) =>
          option.tenantId === tenantId && option.groupId === groupId && option.name === name,
      ) ?? null
    );
  }

  async createModifierOption(
    tenantId: string,
    input: Parameters<CatalogRepository["createModifierOption"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const option: CatalogModifierOptionRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.modifierOptions.set(this.key(tenantId, option.id), option);
    this.mutationContexts.push(context);
    return option;
  }

  async updateModifierOption(
    tenantId: string,
    optionId: string,
    input: Parameters<CatalogRepository["updateModifierOption"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.modifierOptions.get(this.key(tenantId, optionId));
    assert.ok(current);
    const option: CatalogModifierOptionRecord = {
      ...current,
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.priceDeltaMinor !== undefined ? { priceDeltaMinor: input.priceDeltaMinor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.modifierOptions.set(this.key(tenantId, optionId), option);
    this.mutationContexts.push(context);
    return option;
  }

  async findProductModifierGroupById(tenantId: string, assignmentId: string) {
    return this.productModifierGroups.get(this.key(tenantId, assignmentId)) ?? null;
  }

  async findProductModifierGroup(tenantId: string, productId: string, modifierGroupId: string) {
    return (
      [...this.productModifierGroups.values()].find(
        (assignment) =>
          assignment.tenantId === tenantId &&
          assignment.productId === productId &&
          assignment.modifierGroupId === modifierGroupId,
      ) ?? null
    );
  }

  async createProductModifierGroup(
    tenantId: string,
    input: Parameters<CatalogRepository["createProductModifierGroup"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const assignment: CatalogProductModifierGroupRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.productModifierGroups.set(this.key(tenantId, assignment.id), assignment);
    this.mutationContexts.push(context);
    return assignment;
  }

  async updateProductModifierGroup(
    tenantId: string,
    assignmentId: string,
    input: Parameters<CatalogRepository["updateProductModifierGroup"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.productModifierGroups.get(this.key(tenantId, assignmentId));
    assert.ok(current);
    const assignment: CatalogProductModifierGroupRecord = {
      ...current,
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.productModifierGroups.set(this.key(tenantId, assignmentId), assignment);
    this.mutationContexts.push(context);
    return assignment;
  }

  async findProductImageById(tenantId: string, imageId: string) {
    return this.productImages.get(this.key(tenantId, imageId)) ?? null;
  }

  async findProductImageByObjectKey(tenantId: string, objectKey: string) {
    return (
      [...this.productImages.values()].find(
        (image) => image.tenantId === tenantId && image.objectKey === objectKey,
      ) ?? null
    );
  }

  private clearPrimaryImage(tenantId: string, productId: string, exceptId?: string) {
    for (const [key, image] of this.productImages) {
      if (
        image.tenantId === tenantId &&
        image.productId === productId &&
        image.id !== exceptId &&
        image.isPrimary &&
        image.status === "ACTIVE"
      ) {
        this.productImages.set(key, { ...image, isPrimary: false, updatedAt: new Date() });
      }
    }
  }

  async createProductImage(
    tenantId: string,
    input: Parameters<CatalogRepository["createProductImage"]>[1],
    context?: CatalogMutationContext,
  ) {
    if (input.isPrimary) this.clearPrimaryImage(tenantId, input.productId);
    const now = new Date();
    const image: CatalogProductImageRecord = {
      ...input,
      altText: input.altText ?? null,
      createdAt: now,
      height: input.height ?? null,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
      width: input.width ?? null,
    };
    this.productImages.set(this.key(tenantId, image.id), image);
    this.mutationContexts.push(context);
    return image;
  }

  async updateProductImage(
    tenantId: string,
    imageId: string,
    input: Parameters<CatalogRepository["updateProductImage"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.productImages.get(this.key(tenantId, imageId));
    assert.ok(current);
    const status = input.status ?? current.status;
    const isPrimary = status === "INACTIVE" ? false : (input.isPrimary ?? current.isPrimary);
    if (isPrimary) this.clearPrimaryImage(tenantId, current.productId, imageId);
    const image: CatalogProductImageRecord = {
      ...current,
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
      isPrimary,
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
      ...(input.width !== undefined ? { width: input.width } : {}),
    };
    this.productImages.set(this.key(tenantId, imageId), image);
    this.mutationContexts.push(context);
    return image;
  }

  async findOutlet(tenantId: string, outletId: string) {
    const outlet = this.outlets.get(outletId);
    return outlet?.tenantId === tenantId ? outlet : null;
  }

  async findOutletProductById(tenantId: string, outletProductId: string) {
    return this.outletProducts.get(this.key(tenantId, outletProductId)) ?? null;
  }

  async findOutletProduct(tenantId: string, outletId: string, productId: string) {
    return (
      [...this.outletProducts.values()].find(
        (assignment) =>
          assignment.tenantId === tenantId &&
          assignment.outletId === outletId &&
          assignment.productId === productId,
      ) ?? null
    );
  }

  async createOutletProduct(
    tenantId: string,
    input: Parameters<CatalogRepository["createOutletProduct"]>[1],
    context?: CatalogMutationContext,
  ) {
    const now = new Date();
    const outletProduct: CatalogOutletProductRecord = {
      ...input,
      createdAt: now,
      id: randomUUID(),
      status: "ACTIVE",
      tenantId,
      updatedAt: now,
    };
    this.outletProducts.set(this.key(tenantId, outletProduct.id), outletProduct);
    this.mutationContexts.push(context);
    return outletProduct;
  }

  async updateOutletProduct(
    tenantId: string,
    outletProductId: string,
    input: Parameters<CatalogRepository["updateOutletProduct"]>[2],
    context?: CatalogMutationContext,
  ) {
    const current = this.outletProducts.get(this.key(tenantId, outletProductId));
    assert.ok(current);
    const outletProduct: CatalogOutletProductRecord = {
      ...current,
      ...(input.availabilityOverride !== undefined
        ? { availabilityOverride: input.availabilityOverride }
        : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.priceOverrideMinor !== undefined
        ? { priceOverrideMinor: input.priceOverrideMinor }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    };
    this.outletProducts.set(this.key(tenantId, outletProductId), outletProduct);
    this.mutationContexts.push(context);
    return outletProduct;
  }

  async getSnapshot(tenantId: string) {
    if (!this.tenants.has(tenantId)) return null;
    return {
      categories: [...this.categories.values()].filter((item) => item.tenantId === tenantId),
      modifierGroups: [...this.modifierGroups.values()].filter(
        (item) => item.tenantId === tenantId,
      ),
      modifierOptions: [...this.modifierOptions.values()].filter(
        (item) => item.tenantId === tenantId,
      ),
      outletProducts: [...this.outletProducts.values()].filter(
        (item) => item.tenantId === tenantId,
      ),
      productImages: [...this.productImages.values()].filter((item) => item.tenantId === tenantId),
      productModifierGroups: [...this.productModifierGroups.values()].filter(
        (item) => item.tenantId === tenantId,
      ),
      productVariants: [...this.productVariants.values()].filter(
        (item) => item.tenantId === tenantId,
      ),
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

async function createProduct(service: CatalogService, tenantId: string, slug = "kopi-susu") {
  const category = await createCategory(service, tenantId, `${slug}-category`);
  return service.createProduct(tenantId, {
    availability: "AVAILABLE",
    basePriceMinor: "20000",
    categoryId: category.id,
    currency: "IDR",
    name: slug === "kopi-susu" ? "Kopi Susu" : "Produk Tenant",
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

test("builds tenant-scoped product composition with exact surcharge prices", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A);
  const variant = await service.createProductVariant(TENANT_A, {
    availability: "AVAILABLE",
    displayOrder: 0,
    name: "Large",
    priceDeltaMinor: "5000",
    productId: product.id,
  });
  const group = await service.createModifierGroup(TENANT_A, {
    displayOrder: 0,
    maxSelections: 2,
    minSelections: 1,
    name: "Extra Topping",
    selectionType: "MULTIPLE",
  });
  const option = await service.createModifierOption(TENANT_A, {
    availability: "AVAILABLE",
    displayOrder: 0,
    groupId: group.id,
    name: "Extra Shot",
    priceDeltaMinor: "4000",
  });
  const assignment = await service.createProductModifierGroup(
    TENANT_A,
    { displayOrder: 0, modifierGroupId: group.id, productId: product.id },
    { actorId: ACTOR_ID, requestId: "req_catalog_composition" },
  );
  const image = await service.createProductImage(TENANT_A, {
    contentType: "image/webp",
    displayOrder: 0,
    isPrimary: true,
    objectKey: "tenant-a/catalog/kopi-susu.webp",
    productId: product.id,
  });
  const snapshot = await service.getSnapshot(TENANT_A);

  assert.equal(variant.priceDeltaMinor, "5000");
  assert.equal(option.priceDeltaMinor, "4000");
  assert.equal(assignment.status, "ACTIVE");
  assert.equal(image.isPrimary, true);
  assert.equal(snapshot.productVariants.length, 1);
  assert.equal(snapshot.modifierGroups.length, 1);
  assert.equal(snapshot.modifierOptions.length, 1);
  assert.equal(snapshot.productModifierGroups.length, 1);
  assert.equal(snapshot.productImages.length, 1);
  assert.deepEqual(repository.mutationContexts.at(-2), {
    actorId: ACTOR_ID,
    requestId: "req_catalog_composition",
  });
});

test("rejects cross-tenant composition parents and invalid merged modifier rules", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const productA = await createProduct(service, TENANT_A, "produk-a");
  const groupB = await service.createModifierGroup(TENANT_B, {
    displayOrder: 0,
    maxSelections: 1,
    minSelections: 0,
    name: "Group Tenant B",
    selectionType: "SINGLE",
  });

  await assert.rejects(
    () =>
      service.createProductVariant(TENANT_B, {
        availability: "AVAILABLE",
        displayOrder: 0,
        name: "Silang",
        priceDeltaMinor: "0",
        productId: productA.id,
      }),
    NotFoundException,
  );
  await assert.rejects(
    () =>
      service.createProductModifierGroup(TENANT_A, {
        displayOrder: 0,
        modifierGroupId: groupB.id,
        productId: productA.id,
      }),
    NotFoundException,
  );

  const single = await service.createModifierGroup(TENANT_A, {
    displayOrder: 0,
    maxSelections: 1,
    minSelections: 0,
    name: "Pilihan Size",
    selectionType: "SINGLE",
  });
  await assert.rejects(() =>
    service.updateModifierGroup(TENANT_A, single.id, { maxSelections: 2 }),
  );
});

test("keeps at most one active primary image per product", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "produk-image");
  const first = await service.createProductImage(TENANT_A, {
    contentType: "image/png",
    displayOrder: 0,
    isPrimary: true,
    objectKey: "tenant-a/catalog/first.png",
    productId: product.id,
  });
  const second = await service.createProductImage(TENANT_A, {
    contentType: "image/webp",
    displayOrder: 1,
    isPrimary: true,
    objectKey: "tenant-a/catalog/second.webp",
    productId: product.id,
  });
  let snapshot = await service.getSnapshot(TENANT_A);

  assert.equal(snapshot.productImages.find((image) => image.id === first.id)?.isPrimary, false);
  assert.equal(snapshot.productImages.find((image) => image.id === second.id)?.isPrimary, true);

  const inactive = await service.updateProductImage(TENANT_A, second.id, { status: "INACTIVE" });
  snapshot = await service.getSnapshot(TENANT_A);
  assert.equal(inactive.isPrimary, false);
  assert.equal(snapshot.productImages.filter((image) => image.isPrimary).length, 0);
});

test("blocks new options and assignments below inactive composition parents", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "produk-inactive-parent");
  const group = await service.createModifierGroup(TENANT_A, {
    displayOrder: 0,
    maxSelections: 1,
    minSelections: 0,
    name: "Group Nonaktif",
    selectionType: "SINGLE",
  });
  await service.updateModifierGroup(TENANT_A, group.id, { status: "INACTIVE" });

  await assert.rejects(
    () =>
      service.createModifierOption(TENANT_A, {
        availability: "AVAILABLE",
        displayOrder: 0,
        groupId: group.id,
        name: "Option",
        priceDeltaMinor: "0",
      }),
    ConflictException,
  );
  await assert.rejects(
    () =>
      service.createProductModifierGroup(TENANT_A, {
        displayOrder: 0,
        modifierGroupId: group.id,
        productId: product.id,
      }),
    ConflictException,
  );
});

test("inherits master price and availability for an outlet assignment", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "outlet-inherit");
  const assignment = await service.createOutletProduct(
    TENANT_A,
    {
      availabilityOverride: null,
      displayOrder: 0,
      outletId: OUTLET_A,
      priceOverrideMinor: null,
      productId: product.id,
    },
    { actorId: ACTOR_ID, requestId: "req_outlet_catalog" },
  );
  const outletCatalog = await service.getOutletCatalog(TENANT_A, OUTLET_A);
  const item = outletCatalog.items[0];

  assert.ok(item);
  assert.equal(item.assignment.id, assignment.id);
  assert.equal(item.effectivePriceMinor, "20000");
  assert.equal(item.effectiveAvailability, "AVAILABLE");
  assert.equal(item.inheritsPrice, true);
  assert.equal(item.inheritsAvailability, true);
  assert.equal(item.sellable, true);
  assert.deepEqual(repository.mutationContexts.at(-1), {
    actorId: ACTOR_ID,
    requestId: "req_outlet_catalog",
  });
});

test("applies and clears exact outlet price and sold-out overrides", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "outlet-override");
  const assignment = await service.createOutletProduct(TENANT_A, {
    availabilityOverride: "SOLD_OUT",
    displayOrder: 1,
    outletId: OUTLET_A,
    priceOverrideMinor: "27500",
    productId: product.id,
  });
  let item = (await service.getOutletCatalog(TENANT_A, OUTLET_A)).items[0];

  assert.equal(item?.effectivePriceMinor, "27500");
  assert.equal(item?.effectiveAvailability, "SOLD_OUT");
  assert.equal(item?.sellable, false);

  await service.updateOutletProduct(TENANT_A, assignment.id, {
    availabilityOverride: null,
    priceOverrideMinor: null,
  });
  item = (await service.getOutletCatalog(TENANT_A, OUTLET_A)).items[0];
  assert.equal(item?.effectivePriceMinor, "20000");
  assert.equal(item?.effectiveAvailability, "AVAILABLE");
  assert.equal(item?.inheritsPrice, true);
  assert.equal(item?.sellable, true);
});

test("rejects cross-tenant, duplicate, and inactive-outlet assignments", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "outlet-isolation");
  const input = {
    availabilityOverride: null,
    displayOrder: 0,
    priceOverrideMinor: null,
    productId: product.id,
  } as const;

  await assert.rejects(
    () => service.createOutletProduct(TENANT_A, { ...input, outletId: OUTLET_B }),
    NotFoundException,
  );
  await assert.rejects(
    () => service.createOutletProduct(TENANT_B, { ...input, outletId: OUTLET_B }),
    NotFoundException,
  );
  await assert.rejects(
    () => service.createOutletProduct(TENANT_A, { ...input, outletId: OUTLET_INACTIVE }),
    ConflictException,
  );

  const assignment = await service.createOutletProduct(TENANT_A, {
    ...input,
    outletId: OUTLET_A,
  });
  await assert.rejects(
    () => service.createOutletProduct(TENANT_A, { ...input, outletId: OUTLET_A }),
    ConflictException,
  );
  await assert.rejects(
    () =>
      service.updateOutletProduct(
        TENANT_A,
        assignment.id,
        { status: "INACTIVE" },
        undefined,
        OUTLET_B,
      ),
    NotFoundException,
  );
});

test("marks an inactive outlet assignment as non-sellable without deleting it", async () => {
  const repository = new InMemoryCatalogRepository();
  const service = new CatalogService(repository);
  const product = await createProduct(service, TENANT_A, "outlet-inactive-assignment");
  const assignment = await service.createOutletProduct(TENANT_A, {
    availabilityOverride: null,
    displayOrder: 0,
    outletId: OUTLET_A,
    priceOverrideMinor: null,
    productId: product.id,
  });
  await service.updateOutletProduct(TENANT_A, assignment.id, { status: "INACTIVE" });
  await service.updateProduct(TENANT_A, product.id, { status: "INACTIVE" });
  await assert.rejects(
    () => service.updateOutletProduct(TENANT_A, assignment.id, { status: "ACTIVE" }),
    ConflictException,
  );
  const item = (await service.getOutletCatalog(TENANT_A, OUTLET_A)).items[0];

  assert.equal(item?.assignment.status, "INACTIVE");
  assert.equal(item?.sellable, false);
  assert.equal((await service.getSnapshot(TENANT_A)).outletProducts.length, 1);
});
