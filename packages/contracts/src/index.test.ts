import assert from "node:assert/strict";
import test from "node:test";

import {
  API_HEADERS,
  authLoginRequestSchema,
  authSessionSchema,
  createBrandSchema,
  createOutletSchema,
  createTenantSchema,
  commonOpenApiSchemas,
  createCatalogCategorySchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogOutletProductSchema,
  createCatalogOutletProductForOutletSchema,
  createCatalogProductSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductVariantSchema,
  createMembershipSchema,
  createRoleSchema,
  cursorPaginationQuerySchema,
  entitlementSnapshotSchema,
  MODULES,
  PLAN_CODES,
  replaceSubscriptionSchema,
  requestContextHeadersSchema,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  setTenantEntitlementSchema,
  updateMembershipSchema,
  updateCatalogModifierGroupSchema,
  updateCatalogOutletProductSchema,
  updateCatalogProductSchema,
  updateTenantSchema,
} from "./index.js";

test("normalizes cursor pagination input", () => {
  assert.deepEqual(cursorPaginationQuerySchema.parse({ limit: "40" }), { limit: 40 });
  assert.deepEqual(cursorPaginationQuerySchema.parse({}), { limit: 25 });
  assert.equal(cursorPaginationQuerySchema.safeParse({ limit: 101 }).success, false);
});

test("requires valid tenant and outlet scope headers", () => {
  const result = requestContextHeadersSchema.safeParse({
    [API_HEADERS.outletId]: "019f6f43-c11e-7aa0-a3a1-f39c7ca1a4ba",
    [API_HEADERS.tenantId]: "019f6f43-c11e-7aa0-a3a1-f39c7ca1a4bb",
  });

  assert.equal(result.success, true);
  assert.equal(requestContextHeadersSchema.safeParse({}).success, false);
});

test("exports OpenAPI-compatible common schemas", () => {
  assert.equal(commonOpenApiSchemas.ApiError.type, "object");
  assert.equal(commonOpenApiSchemas.AuthSession.type, "object");
  assert.equal(commonOpenApiSchemas.HealthResponse.type, "object");
});

test("normalizes login input and validates session output", () => {
  assert.deepEqual(
    authLoginRequestSchema.parse({ email: "  Owner@Example.com ", password: "rahasia-kuat" }),
    { email: "owner@example.com", password: "rahasia-kuat" },
  );

  assert.equal(
    authSessionSchema.safeParse({
      expiresAt: "2026-08-17T10:00:00.000Z",
      user: {
        displayName: "Pemilik Merchant",
        email: "owner@example.com",
        id: "019f738d-e61f-7d46-92de-17b35f970b91",
      },
    }).success,
    true,
  );
});

test("normalizes tenant, brand, and outlet registry input", () => {
  assert.deepEqual(
    createTenantSchema.parse({ name: "  Kopi Nusantara ", slug: "Kopi-Nusantara" }),
    {
      name: "Kopi Nusantara",
      slug: "kopi-nusantara",
    },
  );
  assert.deepEqual(createBrandSchema.parse({ name: "Kopi Kita", slug: "kopi-kita" }), {
    name: "Kopi Kita",
    slug: "kopi-kita",
  });
  assert.deepEqual(
    createOutletSchema.parse({
      brandId: "019f738d-e61f-7d46-92de-17b35f970b91",
      code: " bdg-01 ",
      name: "Bandung Utama",
    }),
    {
      brandId: "019f738d-e61f-7d46-92de-17b35f970b91",
      code: "BDG-01",
      name: "Bandung Utama",
      timezone: "Asia/Jakarta",
    },
  );
  assert.equal(updateTenantSchema.safeParse({}).success, false);
});

test("exports organization schemas for future authorized routes", () => {
  assert.equal(commonOpenApiSchemas.Tenant.type, "object");
  assert.equal(commonOpenApiSchemas.Brand.type, "object");
  assert.equal(commonOpenApiSchemas.Outlet.type, "object");
  assert.equal(commonOpenApiSchemas.OrganizationSnapshot.type, "object");
});

test("validates tenant access contracts and rejects ambiguous outlet scope", () => {
  const tenantId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const outletId = "019f738d-e61f-7d46-92de-17b35f970b92";
  const roleId = "019f738d-e61f-7d46-92de-17b35f970b93";
  const userId = "019f738d-e61f-7d46-92de-17b35f970b94";

  assert.equal(
    tenantRequestHeadersSchema.safeParse({ [API_HEADERS.tenantId]: tenantId }).success,
    true,
  );
  assert.deepEqual(
    createRoleSchema.parse({
      code: " kasir_cabang ",
      name: "Kasir Cabang",
      permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.paymentConfirm],
    }),
    {
      code: "KASIR_CABANG",
      name: "Kasir Cabang",
      permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.paymentConfirm],
    },
  );
  assert.equal(
    createMembershipSchema.safeParse({
      allOutlets: true,
      outletIds: [outletId],
      roleIds: [roleId],
      userId,
    }).success,
    false,
  );
  assert.equal(updateMembershipSchema.safeParse({}).success, false);
});

test("exports access-control schemas to OpenAPI", () => {
  assert.equal(commonOpenApiSchemas.AuthorizationContext.type, "object");
  assert.equal(commonOpenApiSchemas.Membership.type, "object");
  assert.equal(commonOpenApiSchemas.Role.type, "object");
  assert.equal(commonOpenApiSchemas.TenantRequestHeaders.type, "object");
});

test("validates subscription and entitlement core contracts", () => {
  assert.equal(
    replaceSubscriptionSchema.safeParse({
      planCode: PLAN_CODES.cafeOperations,
      startsAt: "2026-07-20T00:00:00.000Z",
      status: "ACTIVE",
    }).success,
    true,
  );
  assert.deepEqual(
    setTenantEntitlementSchema.parse({
      enabled: true,
      moduleKey: MODULES.inventoryBasic,
      reason: "  Add-on pilot merchant  ",
    }),
    {
      enabled: true,
      moduleKey: MODULES.inventoryBasic,
      reason: "Add-on pilot merchant",
    },
  );
  assert.equal(
    entitlementSnapshotSchema.safeParse({ modules: [], subscription: null }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.EntitlementSnapshot.type, "object");
});

test("normalizes catalog defaults and preserves exact minor-unit prices", () => {
  const category = createCatalogCategorySchema.parse({ name: "  Minuman ", slug: "Minuman" });
  assert.deepEqual(category, { displayOrder: 0, name: "Minuman", slug: "minuman" });

  const product = createCatalogProductSchema.parse({
    basePriceMinor: "25000",
    categoryId: "019f738d-e61f-7d46-92de-17b35f971101",
    name: "  Kopi Susu ",
    slug: "Kopi-Susu",
  });
  assert.equal(product.basePriceMinor, "25000");
  assert.equal(product.currency, "IDR");
  assert.equal(product.availability, "AVAILABLE");
  assert.equal(
    createCatalogProductSchema.safeParse({ ...product, basePriceMinor: "-1" }).success,
    false,
  );
  assert.equal(updateCatalogProductSchema.safeParse({}).success, false);
  assert.equal(commonOpenApiSchemas.CatalogSnapshot.type, "object");
});

test("validates product composition defaults and modifier selection rules", () => {
  const productId = "019f738d-e61f-7d46-92de-17b35f971201";
  const groupId = "019f738d-e61f-7d46-92de-17b35f971202";

  assert.deepEqual(createCatalogProductVariantSchema.parse({ name: "Regular", productId }), {
    availability: "AVAILABLE",
    displayOrder: 0,
    name: "Regular",
    priceDeltaMinor: "0",
    productId,
  });
  assert.deepEqual(createCatalogModifierGroupSchema.parse({ name: "Pilihan Gula" }), {
    displayOrder: 0,
    maxSelections: 1,
    minSelections: 0,
    name: "Pilihan Gula",
    selectionType: "SINGLE",
  });
  assert.equal(
    createCatalogModifierGroupSchema.safeParse({
      maxSelections: 2,
      minSelections: 0,
      name: "Ukuran",
      selectionType: "SINGLE",
    }).success,
    false,
  );
  assert.equal(updateCatalogModifierGroupSchema.safeParse({}).success, false);
  assert.equal(
    createCatalogModifierOptionSchema.parse({ groupId, name: "Tanpa Gula" }).priceDeltaMinor,
    "0",
  );
  assert.equal(
    createCatalogProductModifierGroupSchema.parse({ modifierGroupId: groupId, productId })
      .displayOrder,
    0,
  );
});

test("validates product image object keys and safe image metadata", () => {
  const productId = "019f738d-e61f-7d46-92de-17b35f971203";
  const image = createCatalogProductImageSchema.parse({
    contentType: "image/webp",
    height: 1200,
    objectKey: "tenant-a/catalog/kopi-susu.webp",
    productId,
    width: 1200,
  });

  assert.equal(image.isPrimary, false);
  assert.equal(image.displayOrder, 0);
  assert.equal(
    createCatalogProductImageSchema.safeParse({
      contentType: "image/svg+xml",
      objectKey: "../unsafe.svg",
      productId,
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.CatalogProductImage.type, "object");
  assert.equal(commonOpenApiSchemas.CatalogProductVariant.type, "object");
});

test("normalizes outlet catalog inheritance and exact price overrides", () => {
  const outletId = "019f738d-e61f-7d46-92de-17b35f971301";
  const productId = "019f738d-e61f-7d46-92de-17b35f971302";
  const inherited = createCatalogOutletProductSchema.parse({ outletId, productId });

  assert.deepEqual(inherited, {
    availabilityOverride: null,
    displayOrder: 0,
    outletId,
    priceOverrideMinor: null,
    productId,
  });
  assert.equal(
    createCatalogOutletProductSchema.parse({
      availabilityOverride: "SOLD_OUT",
      outletId,
      priceOverrideMinor: "27500",
      productId,
    }).priceOverrideMinor,
    "27500",
  );
  assert.equal(
    createCatalogOutletProductSchema.safeParse({
      outletId,
      priceOverrideMinor: "-1",
      productId,
    }).success,
    false,
  );
  assert.equal(updateCatalogOutletProductSchema.safeParse({}).success, false);
  assert.deepEqual(createCatalogOutletProductForOutletSchema.parse({ productId }), {
    availabilityOverride: null,
    displayOrder: 0,
    priceOverrideMinor: null,
    productId,
  });
  assert.equal(commonOpenApiSchemas.CatalogOutletSnapshot.type, "object");
});
