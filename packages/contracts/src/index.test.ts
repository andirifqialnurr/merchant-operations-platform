import assert from "node:assert/strict";
import test from "node:test";

import {
  API_HEADERS,
  authLoginRequestSchema,
  authSessionSchema,
  commonOpenApiSchemas,
  cursorPaginationQuerySchema,
  requestContextHeadersSchema,
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
