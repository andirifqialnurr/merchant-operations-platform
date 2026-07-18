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
  createMembershipSchema,
  createRoleSchema,
  cursorPaginationQuerySchema,
  requestContextHeadersSchema,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  updateMembershipSchema,
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
