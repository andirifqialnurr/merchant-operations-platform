import assert from "node:assert/strict";
import test from "node:test";

import { cursorPaginationQuerySchema } from "@merchant/contracts";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { mapExceptionToApiError } from "./api-exception.filter.js";
import { AppModule } from "./app.module.js";
import { createOpenApiDocument, isOpenApiEnabled } from "./openapi.js";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

test("maps known and unknown exceptions to the stable error contract", () => {
  const known = mapExceptionToApiError(
    new BadRequestException({ code: "INVALID_CURSOR", message: "Cursor tidak valid." }),
    "req_known",
  );
  const unknown = mapExceptionToApiError(new Error("sensitive"), "req_unknown");
  const internal = mapExceptionToApiError(
    new InternalServerErrorException("sensitive"),
    "req_internal",
  );

  assert.equal(known.body.code, "INVALID_CURSOR");
  assert.equal(known.statusCode, 400);
  assert.equal(unknown.body.message, "Terjadi kesalahan internal.");
  assert.equal(internal.body.message, "Terjadi kesalahan internal.");
});

test("validates and normalizes input through shared Zod schemas", () => {
  const pipe = new ZodValidationPipe(cursorPaginationQuerySchema);

  assert.deepEqual(pipe.transform({ limit: "10" }), { limit: 10 });
  assert.throws(() => pipe.transform({ limit: 0 }), BadRequestException);
});

test("only enables interactive API documentation outside production", () => {
  assert.equal(isOpenApiEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isOpenApiEnabled({ API_DOCS_ENABLED: "false", NODE_ENV: "development" }), false);
  assert.equal(isOpenApiEnabled({ API_DOCS_ENABLED: "true", NODE_ENV: "production" }), false);
});

test("generates versioned OpenAPI paths and shared schemas", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");

  try {
    const document = createOpenApiDocument(app);

    assert.ok(document.paths["/api/v1/auth/login"]);
    assert.ok(document.paths["/api/v1/auth/logout"]);
    assert.ok(document.paths["/api/v1/auth/session"]);
    assert.ok(document.paths["/api/v1/health"]);
    assert.ok(document.paths["/api/v1/access/context"]);
    assert.ok(document.paths["/api/v1/access/memberships"]);
    assert.ok(document.paths["/api/v1/access/roles"]);
    assert.ok(document.paths["/api/v1/organization"]);
    assert.ok(document.paths["/api/v1/organization/brands"]);
    assert.ok(document.paths["/api/v1/organization/outlets"]);
    assert.ok(document.paths["/api/v1/platform/auth/login"]);
    assert.ok(document.paths["/api/v1/platform/auth/logout"]);
    assert.ok(document.paths["/api/v1/platform/auth/session"]);
    assert.ok(document.paths["/api/v1/platform/context"]);
    assert.ok(document.paths["/api/v1/platform/tenants"]);
    assert.ok(document.paths["/api/v1/platform/tenants/{id}"]);
    assert.ok(document.paths["/api/v1/platform/tenants/{id}/subscriptions"]);
    assert.ok(document.paths["/api/v1/platform/tenants/{id}/entitlements/{moduleKey}"]);
    assert.ok(document.components?.schemas?.ApiError);
    assert.ok(document.components?.schemas?.AuthSession);
    assert.ok(document.components?.schemas?.OrganizationSnapshot);
    assert.ok(document.components?.schemas?.PlatformSession);
    assert.ok(document.components?.schemas?.PlatformTenantMaster);
    assert.ok(document.components?.schemas?.PlatformUser);
    assert.ok(document.components?.schemas?.AuthorizationContext);
    assert.ok(document.components?.schemas?.Membership);
    assert.ok(document.components?.schemas?.Role);
    assert.ok(document.components?.schemas?.HealthResponse);
    assert.ok(document.components?.schemas?.RequestContextHeaders);
    assert.ok(document.components?.securitySchemes?.merchant_session);
    assert.ok(document.components?.securitySchemes?.platform_session);
    assert.equal(document.paths["/api/v1/tenants"], undefined);
  } finally {
    await app.close();
  }
});
