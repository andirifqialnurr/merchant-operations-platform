import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { runTransactionalWorkspaceCommand } from "../src/core/idempotency/public.ts";
import { PrismaInventoryUnitWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-writer.ts";
import {
  attempt,
  denied,
  fixture,
  scopeOf,
  snapshot,
} from "./inventory-category-create-fixture.mjs";

test("create Inventory category commits only an authorized ACTIVE master, critical audit and original replay", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, writer, command, query } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();
      const usageBefore = await db.coreUsageEvent.count();

      await t.test(
        "create returns only id/name/ACTIVE and one safely attributed critical audit/key, visible through existing query",
        async () => {
          const ctx = attempt(a);
          const result = await command.execute({ name: "Bahan Kering" }, ctx);
          assert.deepEqual(result, { id: result.id, name: "Bahan Kering", status: "ACTIVE" });
          assert.deepEqual(Object.keys(result).sort(), ["id", "name", "status"]);
          const audit = await db.auditLog.findFirstOrThrow({
            where: {
              tenantId: a.tenantId,
              action: "inventory.category.create",
              entityId: result.id,
            },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.outletId, null);
          assert.equal(audit.entityType, "inventory_category");
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.equal(audit.correlationId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, { critical: true, after: { status: "ACTIVE" } });
          assert.ok(!JSON.stringify(audit).includes(result.name));
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(record.outletId, null);
          assert.equal(record.status, "COMPLETED");
          assert.equal(record.responseStatus, 201);
          assert.deepEqual(record.responseBody, result);
          assert.match(record.requestHash, /^[a-f0-9]{64}$/);
          const page = await query.execute({ status: "ACTIVE" }, a);
          assert.deepEqual(page.items, [result]);
        },
      );

      await t.test(
        "trimmed retries replay original name/ACTIVE after later rename/inactive without rewriting current row/audit/key",
        async () => {
          const key = `normalized:${randomUUID()}`;
          const first = await command.execute({ name: " Bahan Basah " }, attempt(a, ` ${key} `));
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key },
          });
          await db.inventoryCategory.update({
            where: { id: first.id },
            data: { name: "Renamed category", status: "INACTIVE" },
          });
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(await command.execute({ name: "Bahan Basah" }, attempt(a, key)), first);
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
          const current = await query.execute({ status: "INACTIVE" }, a);
          assert.deepEqual(current.items, [
            { id: first.id, name: "Renamed category", status: "INACTIVE" },
          ]);
          await denied(
            command.execute({ name: "BAHAN BASAH" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
        },
      );

      await t.test(
        "eight same-key creates produce one category/critical audit/completed result",
        async () => {
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () => command.execute({ name: "Concurrent same key" }, ctx)),
          );
          assert.equal(new Set(results.map((row) => row.id)).size, 1);
          assert.equal(
            await db.inventoryCategory.count({
              where: { tenantId: a.tenantId, name: "Concurrent same key" },
            }),
            1,
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: results[0].id,
                action: "inventory.category.create",
              },
            }),
            1,
          );
          assert.equal(
            await db.idempotencyKey.count({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            }),
            1,
          );
        },
      );

      await t.test(
        "different-key CI name race and inactive duplicate return conflict without failed reservations or reactivation",
        async () => {
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.allSettled([
            command.execute({ name: "Race Name" }, contexts[0]),
            command.execute({ name: "RACE NAME" }, contexts[1]),
          ]);
          assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
          const failure = results.find((row) => row.status === "rejected").reason;
          assert.equal(failure.getResponse().code, "INVENTORY_CATEGORY_NAME_TAKEN");
          assert.deepEqual(Object.keys(failure.getResponse()).sort(), ["code", "message"]);
          assert.equal(
            await db.idempotencyKey.count({
              where: {
                tenantId: a.tenantId,
                scope: scopeOf(a),
                key: { in: contexts.map((ctx) => ctx.idempotencyKey) },
              },
            }),
            1,
          );
          const inactive = await db.inventoryCategory.create({
            data: { tenantId: a.tenantId, name: "Retired category", status: "INACTIVE" },
          });
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute({ name: " RETIRED CATEGORY " }, attempt(a)),
            "INVENTORY_CATEGORY_NAME_TAKEN",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.inventoryCategory.findUniqueOrThrow({ where: { id: inactive.id } }),
            inactive,
          );
        },
      );

      await t.test(
        "tenant/actor/operation scope prevents replaying another caller; same name is allowed only across workspaces",
        async () => {
          const key = `shared:${randomUUID()}`;
          const first = await command.execute({ name: "Shared name" }, attempt(a, key));
          const foreign = await command.execute({ name: "Shared name" }, attempt(b, key));
          assert.notEqual(first.id, foreign.id);
          const user = await db.user.create({
            data: {
              displayName: "Other owner",
              email: "category-other-owner@example.test",
              passwordHash: "fixture-only",
            },
          });
          const membership = await db.tenantMembership.create({
            data: { tenantId: a.tenantId, userId: user.id, allOutlets: true },
          });
          const owner = await db.role.findUniqueOrThrow({
            where: { tenantId_code: { tenantId: a.tenantId, code: "OWNER" } },
          });
          await db.userRole.create({
            data: { tenantId: a.tenantId, membershipId: membership.id, roleId: owner.id },
          });
          const other = { tenantId: a.tenantId, userId: user.id, membershipId: membership.id };
          await denied(
            command.execute({ name: "Shared name" }, attempt(other, key)),
            "INVENTORY_CATEGORY_NAME_TAKEN",
          );
          assert.equal(
            await db.idempotencyKey.count({
              where: { tenantId: a.tenantId, scope: scopeOf(other), key },
            }),
            0,
          );
          const own = await command.execute({ name: "Other owner name" }, attempt(other, key));
          assert.notEqual(first.id, own.id);
          const unit = await new PrismaInventoryUnitWriter().create(
            { tenantId: a.tenantId, actorId: a.userId },
            { code: "scope", name: "Operation", precision: 0, dimension: "COUNT" },
            attempt(a, key),
          );
          assert.notEqual(first.id, unit.id);
          assert.deepEqual(await command.execute({ name: "Shared name" }, attempt(a, key)), first);
        },
      );

      await t.test(
        "fresh master permission/all-outlet/device/membership/user/subscription/module/install/capability checks precede even replay",
        async () => {
          const ctx = attempt(a);
          const body = { name: "Guarded category" };
          await command.execute(body, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          const owner = await db.role.findUniqueOrThrow({
            where: { tenantId_code: { tenantId: a.tenantId, code: "OWNER" } },
          });
          await db.rolePermission.deleteMany({
            where: {
              tenantId: a.tenantId,
              roleId: owner.id,
              permissionKey: PERMISSIONS.inventoryMasterManage,
            },
          });
          await denied(command.execute(body, ctx), "PERMISSION_DENIED", 403);
          await db.rolePermission.create({
            data: {
              tenantId: a.tenantId,
              roleId: owner.id,
              permissionKey: PERMISSIONS.inventoryMasterManage,
            },
          });
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: false },
          });
          await denied(command.execute(body, ctx), "LOCATION_SCOPE_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: true },
          });
          await denied(
            command.execute(body, { ...ctx, identity: { ...a, deviceId: randomUUID() } }),
            "LOCATION_SCOPE_DENIED",
            403,
          );
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "INACTIVE" },
          });
          await denied(command.execute(body, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "ACTIVE" },
          });
          await db.user.update({ where: { id: a.userId }, data: { status: "DISABLED" } });
          await denied(command.execute(body, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.user.update({ where: { id: a.userId }, data: { status: "ACTIVE" } });
          facts.subscriptionUsable = false;
          await denied(command.execute(body, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          facts.subscriptionUsable = true;
          facts.module.entitled = false;
          await denied(command.execute(body, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.module.entitled = true;
          facts.capabilities.clear();
          await denied(command.execute(body, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.capabilities.add("inventory.item.manage");
          for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
            facts.installation = installation;
            await denied(command.execute(body, ctx), "INSTALLATION_SETUP_REQUIRED");
          }
          facts.installation = "ACTIVE";
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
        },
      );

      await t.test(
        "audit/result name/result status/completion faults roll back category/audit/key and leave the failed key reusable",
        async () => {
          for (const stage of ["audit", "result_name", "result_status", "completion"]) {
            const ctx = attempt(a);
            const name = `Rollback ${stage}`;
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "completion"
                  ? "idempotency_keys"
                  : "inventory_categories";
            const event = stage === "completion" ? "UPDATE" : "INSERT";
            const action =
              stage === "result_name"
                ? "NEW.name := 'unexpected result';"
                : stage === "result_status"
                  ? "NEW.status := 'INACTIVE';"
                  : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_category_create_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_category_create_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_category_create_failure();`);
            try {
              if (stage.startsWith("result"))
                await denied(command.execute({ name }, ctx), "IDEMPOTENCY_RESULT_UNAVAILABLE");
              else await assert.rejects(command.execute({ name }, ctx));
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_category_create_failure ON ${table}; DROP FUNCTION test_category_create_failure()`,
              );
            }
            assert.equal((await command.execute({ name }, ctx)).name, name);
          }
        },
      );

      await t.test(
        "invalid JSON serialization cannot commit category/audit without its replay result",
        async () => {
          const before = await snapshot(db, a.tenantId);
          const key = `serialization:${randomUUID()}`;
          await assert.rejects(
            db.$transaction(async (tx) =>
              runTransactionalWorkspaceCommand(
                tx,
                {
                  tenantId: a.tenantId,
                  scope: scopeOf(a),
                  key,
                  requestHash: "a".repeat(64),
                  responseStatus: 201,
                },
                () => undefined,
                async () => {
                  const row = await tx.inventoryCategory.create({
                    data: { tenantId: a.tenantId, name: "Serialization failure", status: "ACTIVE" },
                  });
                  await tx.auditLog.create({
                    data: {
                      tenantId: a.tenantId,
                      actorId: a.userId,
                      action: "inventory.category.create",
                      entityType: "inventory_category",
                      entityId: row.id,
                      metadata: { critical: true, after: { status: "ACTIVE" } },
                    },
                  });
                  return undefined;
                },
              ),
            ),
            (error) => error.code === "IDEMPOTENCY_RESULT_UNAVAILABLE",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "uncertain/expired/corrupt snapshots, invalid create status and foreign/missing IDs fail closed without new mutation",
        async () => {
          const ctx = attempt(a);
          const body = { name: "Reserved result" };
          const result = await command.execute(body, ctx);
          const foreign = await command.execute(body, attempt(b));
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          const categoriesBefore = await db.inventoryCategory.findMany({ orderBy: { id: "asc" } });
          const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
          for (const [data, expected] of [
            [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
            [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
            [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
            [{ responseStatus: null }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, name: "Other" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, status: "INACTIVE" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [
              { responseBody: { ...result, tenantId: a.tenantId } },
              "IDEMPOTENCY_RESULT_UNAVAILABLE",
            ],
            [{ responseBody: { ...result, itemCount: 0 } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { name: result.name } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
          ]) {
            await db.idempotencyKey.update({ where: { id: record.id }, data });
            await denied(command.execute(body, ctx), expected);
            await db.idempotencyKey.update({
              where: { id: record.id },
              data: {
                status: "COMPLETED",
                expiresAt: record.expiresAt,
                responseStatus: 201,
                responseBody: result,
                requestHash: record.requestHash,
              },
            });
          }
          assert.deepEqual(
            await db.inventoryCategory.findMany({ orderBy: { id: "asc" } }),
            categoriesBefore,
          );
          assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
        },
      );

      await t.test(
        "internal missing scope/invalid origin and client metadata cannot widen writes or override initial status",
        async () => {
          const ctx = attempt(a);
          const before = await snapshot(db, a.tenantId);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(writer.create(scope, { name: "Invalid scope" }, ctx));
          for (const origin of [
            { actorId: b.userId },
            { actorId: a.userId, deviceId: randomUUID() },
            { actorId: a.userId, channel: "INVALID" },
            { actorId: a.userId, requestId: "x".repeat(101) },
          ])
            await assert.rejects(
              writer.create(
                { tenantId: a.tenantId, actorId: a.userId },
                { name: "Invalid origin" },
                { ...ctx, origin },
              ),
            );
          for (const status of ["ACTIVE", "INACTIVE", undefined])
            await denied(
              command.execute({ name: "Client status", status }, ctx),
              "VALIDATION_ERROR",
              400,
            );
          await denied(
            command.execute({ name: "Client scope", tenantId: b.tenantId }, ctx),
            "VALIDATION_ERROR",
            400,
          );
          await denied(
            command.execute(
              { name: "Foreign identity" },
              { ...ctx, identity: { ...a, tenantId: b.tenantId } },
            ),
            "WORKSPACE_ACCESS_DENIED",
            403,
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "category creation stays standalone without usage/outbox/module activation; the reader returns current rather than replay state",
        async () => {
          assert.equal(await db.outboxEvent.count(), outboxBefore);
          assert.equal(await db.coreUsageEvent.count(), usageBefore);
          for (const tenantId of [a.tenantId, b.tenantId])
            for (const delegate of [
              db.coreModuleInstallation,
              db.catalogCategory,
              db.catalogProduct,
              db.order,
              db.kdsTicket,
            ])
              assert.equal(await delegate.count({ where: { tenantId } }), 0);
          const before = await snapshot(db, a.tenantId);
          const page = await query.execute({ limit: 100 }, a);
          assert.deepEqual(
            page.items.map((row) => row.id),
            before.categories.map((row) => row.id),
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
