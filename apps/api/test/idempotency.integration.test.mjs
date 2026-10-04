import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";
import { PERMISSIONS } from "@merchant/contracts";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaIdempotencyRepository } from "../src/core/idempotency/idempotency.repository.ts";
import { BindingController } from "../src/core/integrations/binding.controller.ts";
import { BindingService } from "../src/core/integrations/binding.service.ts";
import { AuthService } from "../src/core/auth/auth.service.ts";
import { AccessService } from "../src/core/memberships/access.service.ts";
import { EntitlementService } from "../src/core/entitlements/entitlement.service.ts";
import { FeatureFlagService } from "../src/core/feature-flags/feature-flag.service.ts";

const { fetch } = globalThis;

test("PostgreSQL reserves workspace-level keys once and replays exact JSON/status across instances", async () => {
  await withDisposablePostgres(async ({ connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const tenant = await db.tenant.create({
        data: { name: "Idempotency A", slug: randomUUID() },
      });
      const other = await db.tenant.create({ data: { name: "Idempotency B", slug: randomUUID() } });
      const first = new PrismaIdempotencyRepository();
      const second = new PrismaIdempotencyRepository();
      const request = {
        tenantId: tenant.id,
        outletId: null,
        scope: "http:test.write",
        key: randomUUID(),
        requestHash: "a".repeat(64),
      };
      const attempts = await Promise.all([first.reserve(request), second.reserve(request)]);
      assert.equal(attempts.filter((r) => r.created).length, 1);
      assert.equal(attempts[0].record.id, attempts[1].record.id);
      await first.complete(attempts[0].record.id, 201, {
        amountMinor: "999999999999999999",
        saved: true,
      });
      const replay = await second.reserve(request);
      assert.equal(replay.record.status, "COMPLETED");
      assert.equal(replay.record.responseStatus, 201);
      assert.deepEqual(replay.record.responseBody, {
        amountMinor: "999999999999999999",
        saved: true,
      });
      assert.equal((await second.reserve({ ...request, tenantId: other.id })).created, true);
      const failed = await first.reserve({ ...request, key: randomUUID() });
      await first.fail(failed.record.id);
      assert.equal(
        (
          await second.reserve({
            ...request,
            key: (await db.idempotencyKey.findUniqueOrThrow({ where: { id: failed.record.id } }))
              .key,
          })
        ).record.status,
        "FAILED",
      );

      // Real Nest routing, interceptor metadata and HTTP serialization; the
      // service is controlled so the test can count side effects precisely.
      let calls = 0;
      let allowed = true;
      const binding = {
        id: randomUUID(),
        workspaceId: tenant.id,
        sourceModuleKey: "CORE_ORDER",
        targetModuleKey: "KDS",
        eventType: "order.submitted.v1",
        handlerKey: "kds.create_ticket",
        status: "ACTIVE",
        health: "STALE",
        auditReason: null,
        lastError: null,
        configSchemaVersion: 1,
        effectiveFrom: new Date().toISOString(),
        effectiveTo: null,
        updatedAt: new Date().toISOString(),
      };
      class TestModule {}
      Module({
        controllers: [BindingController],
        providers: [
          {
            provide: BindingService,
            useValue: {
              retry: async () => {
                calls += 1;
                return binding;
              },
            },
          },
          {
            provide: AccessService,
            useValue: {
              describeAccess: async () => ({
                membershipActive: true,
                context: {
                  allOutlets: true,
                  userId: "owner",
                  tenantId: tenant.id,
                  membershipId: "member",
                  outletIds: [],
                  permissionKeys: allowed ? [PERMISSIONS.organizationManage] : [],
                },
              }),
            },
          },
          {
            provide: AuthService,
            useValue: { getSession: async () => ({ user: { id: "owner" } }) },
          },
          {
            provide: EntitlementService,
            useValue: { describeAccess: async () => ({ subscriptionUsable: true }) },
          },
          { provide: FeatureFlagService, useValue: { enabled: async () => false } },
        ],
      })(TestModule);
      const app = await NestFactory.create(TestModule, { abortOnError: false, logger: false });
      try {
        await app.listen(0, "127.0.0.1");
        const url = `${await app.getUrl()}/modules/bindings/${binding.id}/retry`;
        const headers = { "x-tenant-id": tenant.id, "idempotency-key": randomUUID() };
        const original = await fetch(url, { method: "POST", headers });
        assert.equal(original.status, 200);
        const again = await fetch(url, { method: "POST", headers });
        assert.equal(again.status, 200);
        assert.deepEqual(await again.json(), await original.json());
        assert.equal(calls, 1);
        const different = await fetch(`${url}?changed=1`, { method: "POST", headers });
        assert.equal(different.status, 409);
        assert.equal((await different.json()).code, "IDEMPOTENCY_KEY_REUSED");
        allowed = false;
        const denied = await fetch(url, { method: "POST", headers });
        assert.equal(denied.status, 403, "permission is rechecked before replay");
        allowed = true;
        const noKey = await fetch(url, { method: "POST", headers: { "x-tenant-id": tenant.id } });
        assert.equal(noKey.status, 400);
        assert.equal(calls, 1);
      } finally {
        await app.close();
      }
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
