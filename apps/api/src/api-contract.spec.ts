import assert from "node:assert/strict";
import test from "node:test";

import {
  apiErrorSchema,
  cursorPaginationQuerySchema,
  PLATFORM_PERMISSIONS,
  platformSessionSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { mapExceptionToApiError } from "./api-exception.filter.js";
import { AppModule } from "./app.module.js";
import {
  configureOpenApi,
  createOpenApiDocument,
  isOpenApiEnabled,
  isOpenApiPlatformAuthRequired,
} from "./openapi.js";
import { PlatformAuthService } from "./platform/platform-auth.service.js";
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

test("requires explicit opt-in and platform auth for production API documentation", () => {
  assert.equal(isOpenApiEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isOpenApiEnabled({ API_DOCS_ENABLED: "false", NODE_ENV: "development" }), false);
  assert.equal(isOpenApiEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isOpenApiEnabled({ API_DOCS_ENABLED: "true", NODE_ENV: "production" }), true);
  assert.equal(isOpenApiPlatformAuthRequired({ NODE_ENV: "development" }), false);
  assert.equal(isOpenApiPlatformAuthRequired({ NODE_ENV: "production" }), true);
});

test("protects production Swagger UI, assets, JSON, and YAML with platform permission", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  const allowedToken = "a".repeat(43);
  const forbiddenToken = "f".repeat(43);
  const authService = app.get(PlatformAuthService);
  authService.getSession = async (token: string | undefined) => {
    if (token !== allowedToken && token !== forbiddenToken) {
      throw new UnauthorizedException({
        code: "PLATFORM_AUTH_SESSION_INVALID",
        message: "Sesi platform tidak valid atau sudah berakhir.",
      });
    }

    return platformSessionSchema.parse({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        displayName: "Platform Docs Reader",
        email: "docs@example.com",
        id: "019f738d-e61f-7d46-92de-17b35f970d01",
        permissionKeys: token === allowedToken ? [PLATFORM_PERMISSIONS.docsRead] : [],
        role: "SUPPORT",
      },
    });
  };

  configureOpenApi(app, { API_DOCS_ENABLED: "true", NODE_ENV: "production" });
  await app.listen(0, "127.0.0.1");

  try {
    const baseUrl = await app.getUrl();
    const unauthorizedAsset = await fetch(`${baseUrl}/api/docs/swagger-ui.css`, {
      headers: { cookie: `merchant_session=${allowedToken}` },
    });
    assert.equal(unauthorizedAsset.status, 401);
    const unauthorizedBody = apiErrorSchema.parse(await unauthorizedAsset.json());
    assert.equal(unauthorizedBody.code, "PLATFORM_AUTH_SESSION_INVALID");
    assert.equal(unauthorizedAsset.headers.get("x-request-id"), unauthorizedBody.requestId);

    const invalidHeaders = await fetch(`${baseUrl}/api/openapi.json`, {
      headers: {
        cookie: `platform_session=${allowedToken}`,
        "x-request-id": "x".repeat(101),
      },
    });
    assert.equal(invalidHeaders.status, 400);
    assert.equal(apiErrorSchema.parse(await invalidHeaders.json()).code, "VALIDATION_ERROR");

    const forbiddenJson = await fetch(`${baseUrl}/api/openapi.json`, {
      headers: { cookie: `platform_session=${forbiddenToken}` },
    });
    assert.equal(forbiddenJson.status, 403);
    assert.equal(
      apiErrorSchema.parse(await forbiddenJson.json()).code,
      "PLATFORM_AUTHORIZATION_DENIED",
    );

    const headers = { cookie: `platform_session=${allowedToken}` };
    const [ui, asset, json, yaml] = await Promise.all([
      fetch(`${baseUrl}/api/docs`, { headers }),
      fetch(`${baseUrl}/api/docs/swagger-ui.css`, { headers }),
      fetch(`${baseUrl}/api/openapi.json`, { headers }),
      fetch(`${baseUrl}/api/openapi.yaml`, { headers }),
    ]);
    assert.equal(ui.status, 200);
    assert.match(ui.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type") ?? "", /text\/css/);
    assert.equal(json.status, 200);
    const document = (await json.json()) as { paths?: Record<string, unknown> };
    assert.ok(document.paths?.["/api/v1/platform/context"]);
    assert.equal(yaml.status, 200);
    assert.match(await yaml.text(), /openapi: 3\.0\.0/);
  } finally {
    await app.close();
  }
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
    assert.equal(document.paths["/api/v1/catalog"], undefined);
    assert.equal(document.paths["/api/v1/tenants"], undefined);
  } finally {
    await app.close();
  }
});
