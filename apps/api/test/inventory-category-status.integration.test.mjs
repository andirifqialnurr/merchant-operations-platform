import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import {
  attempt,
  category,
  denied,
  fixture,
  scopeOf,
  snapshot,
} from "./inventory-category-status-fixture.mjs";

test("category lifecycle commits only the selected category status with critical audit and original replay", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, command, statusWriter, creator, renamer, query } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();
      const usageBefore = await db.coreUsageEvent.count();

      await t.test(
        "all four source/target status combinations retain name/identity and distinguish mutation from no-op",
        async () => {
          for (const from of ["ACTIVE", "INACTIVE"]) {
            for (const to of ["ACTIVE", "INACTIVE"]) {
              const original = await category(db, a, { status: from });
              const ctx = attempt(a);
              const result = await command.execute(original.id, { status: to }, ctx);
              assert.deepEqual(result, { id: original.id, name: original.name, status: to });
              assert.deepEqual(Object.keys(result).sort(), ["id", "name", "status"]);
              const row = await db.inventoryCategory.findUniqueOrThrow({
                where: { id: original.id },
              });
              assert.equal(row.tenantId, original.tenantId);
              assert.equal(row.createdAt.getTime(), original.createdAt.getTime());
              assert.equal(row.name, original.name);
              assert.equal(row.status, to);
              const audits = await db.auditLog.findMany({
                where: {
                  tenantId: a.tenantId,
                  entityId: original.id,
                  action: "inventory.category.status_change",
                },
              });
              assert.equal(audits.length, from === to ? 0 : 1);
              if (from === to) assert.deepEqual(row, original);
              else {
                assert.deepEqual(audits[0].metadata, {
                  critical: true,
                  before: { status: from },
                  after: { status: to },
                });
                assert.equal(audits[0].actorId, a.userId);
                assert.equal(audits[0].channel, "WEB");
                assert.equal(audits[0].outletId, null);
                assert.equal(audits[0].entityType, "inventory_category");
                assert.equal(audits[0].requestId, ctx.origin.requestId);
                assert.equal(audits[0].correlationId, ctx.origin.requestId);
                assert.ok(!JSON.stringify(audits[0]).includes(original.name));
              }
              const record = await db.idempotencyKey.findFirstOrThrow({
                where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
              });
              assert.equal(record.status, "COMPLETED");
              assert.equal(record.responseStatus, 200);
              assert.equal(record.outletId, null);
              assert.deepEqual(record.responseBody, result);
              assert.ok(
                (await query.execute({ status: to, limit: 100 }, a)).items.some(
                  (item) => item.id === original.id,
                ),
              );
            }
          }
        },
      );

      await t.test(
        "deactivate/reactivate never cascades to item status/FKs/minimum/unit definitions or active-item usage",
        async () => {
          const original = await category(db, a, { name: "Reserved lifecycle name" });
          const unit = await db.inventoryUnit.create({
            data: {
              tenantId: a.tenantId,
              code: "lifecycle",
              name: "Unit",
              precision: 6,
              dimension: "MASS",
            },
          });
          for (const status of ["ACTIVE", "INACTIVE"])
            await db.inventoryItem.create({
              data: {
                tenantId: a.tenantId,
                name: `Item ${status}`,
                categoryId: original.id,
                baseUnitId: unit.id,
                minStock: "1.000001",
                status,
              },
            });
          const itemsBefore = await db.inventoryItem.findMany({
            where: { tenantId: a.tenantId },
            orderBy: { id: "asc" },
          });
          const unitsBefore = await db.inventoryUnit.findMany({
            where: { tenantId: a.tenantId },
            orderBy: { id: "asc" },
          });
          const activeBefore = await db.inventoryItem.count({
            where: { tenantId: a.tenantId, status: "ACTIVE" },
          });
          const usageCounters = await db.coreUsageCounter.findMany({
            where: { tenantId: a.tenantId },
          });
          await command.execute(original.id, { status: "INACTIVE" }, attempt(a));
          await denied(
            creator.execute({ name: "RESERVED LIFECYCLE NAME" }, attempt(a)),
            "INVENTORY_CATEGORY_NAME_TAKEN",
          );
          await command.execute(original.id, { status: "ACTIVE" }, attempt(a));
          assert.deepEqual(
            await db.inventoryItem.findMany({
              where: { tenantId: a.tenantId },
              orderBy: { id: "asc" },
            }),
            itemsBefore,
          );
          assert.deepEqual(
            await db.inventoryUnit.findMany({
              where: { tenantId: a.tenantId },
              orderBy: { id: "asc" },
            }),
            unitsBefore,
          );
          assert.equal(
            await db.inventoryItem.count({ where: { tenantId: a.tenantId, status: "ACTIVE" } }),
            activeBefore,
          );
          assert.deepEqual(
            await db.coreUsageCounter.findMany({ where: { tenantId: a.tenantId } }),
            usageCounters,
          );
          assert.equal(await db.coreUsageEvent.count(), usageBefore);
        },
      );

      await t.test(
        "foreign and missing targets share one private 404 with no category/audit/key side effects",
        async () => {
          const foreign = await category(db, b);
          const beforeA = await snapshot(db, a.tenantId);
          const beforeB = await snapshot(db, b.tenantId);
          for (const target of [foreign.id, randomUUID()])
            await denied(
              command.execute(target, { status: "INACTIVE" }, attempt(a)),
              "INVENTORY_CATEGORY_NOT_FOUND",
              404,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), beforeA);
          assert.deepEqual(await snapshot(db, b.tenantId), beforeB);
        },
      );

      await t.test(
        "eight same-key transitions yield one mutation audit and one original result",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              command.execute(original.id, { status: "INACTIVE" }, ctx),
            ),
          );
          assert.ok(results.every((row) => row.id === original.id && row.status === "INACTIVE"));
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.status_change",
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
        "no-op result is reserved and never reapplies old status/name after legitimate lifecycle and rename",
        async () => {
          for (const status of ["ACTIVE", "INACTIVE"]) {
            const original = await category(db, a, { status });
            const ctx = attempt(a);
            const first = await command.execute(original.id, { status }, ctx);
            assert.deepEqual(
              await db.inventoryCategory.findUniqueOrThrow({ where: { id: original.id } }),
              original,
            );
            assert.equal(
              await db.auditLog.count({
                where: {
                  tenantId: a.tenantId,
                  entityId: original.id,
                  action: "inventory.category.status_change",
                },
              }),
              0,
            );
            await command.execute(
              original.id,
              { status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
              attempt(a),
            );
            await renamer.execute(original.id, { name: `Later ${status}` }, attempt(a));
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(await command.execute(original.id, { status }, ctx), first);
            assert.deepEqual(await snapshot(db, a.tenantId), before);
          }
        },
      );

      await t.test(
        "fresh master permission/all-outlet/device/membership/user/subscription/module/install/capability checks precede replay",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const input = { status: "INACTIVE" };
          await command.execute(original.id, input, ctx);
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
          await denied(command.execute(original.id, input, ctx), "PERMISSION_DENIED", 403);
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
          await denied(command.execute(original.id, input, ctx), "LOCATION_SCOPE_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: true },
          });
          await denied(
            command.execute(original.id, input, {
              ...ctx,
              identity: { ...a, deviceId: randomUUID() },
            }),
            "LOCATION_SCOPE_DENIED",
            403,
          );
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "INACTIVE" },
          });
          await denied(command.execute(original.id, input, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "ACTIVE" },
          });
          await db.user.update({ where: { id: a.userId }, data: { status: "DISABLED" } });
          await denied(command.execute(original.id, input, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.user.update({ where: { id: a.userId }, data: { status: "ACTIVE" } });
          facts.subscriptionUsable = false;
          await denied(command.execute(original.id, input, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          facts.subscriptionUsable = true;
          facts.module.entitled = false;
          await denied(command.execute(original.id, input, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.module.entitled = true;
          facts.capabilities.clear();
          await denied(command.execute(original.id, input, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.capabilities.add("inventory.item.manage");
          for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
            facts.installation = installation;
            await denied(command.execute(original.id, input, ctx), "INSTALLATION_SETUP_REQUIRED");
          }
          facts.installation = "ACTIVE";
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
        },
      );

      await t.test(
        "audit/result-name/result-status/completion faults roll back row/timestamp/audit/key atomically",
        async () => {
          for (const stage of ["audit", "result_name", "result_status", "completion"]) {
            const original = await category(db, a);
            const ctx = attempt(a);
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "completion"
                  ? "idempotency_keys"
                  : "inventory_categories";
            const event = stage === "audit" ? "INSERT" : "UPDATE";
            const action =
              stage === "result_name"
                ? "NEW.name := 'unexpected lifecycle rename';"
                : stage === "result_status"
                  ? "NEW.status := 'ACTIVE';"
                  : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_category_status_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_category_status_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_category_status_failure();`);
            try {
              if (stage.startsWith("result"))
                await denied(
                  command.execute(original.id, { status: "INACTIVE" }, ctx),
                  "IDEMPOTENCY_RESULT_UNAVAILABLE",
                );
              else await assert.rejects(command.execute(original.id, { status: "INACTIVE" }, ctx));
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_category_status_failure ON ${table}; DROP FUNCTION test_category_status_failure()`,
              );
            }
            assert.equal(
              (await command.execute(original.id, { status: "INACTIVE" }, ctx)).status,
              "INACTIVE",
            );
          }
        },
      );

      await t.test(
        "invalid scope/origin/client-owned fields cannot broaden lifecycle or mutate a name/relation",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const before = await snapshot(db, a.tenantId);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(
              statusWriter.setStatus(scope, original.id, { status: "INACTIVE" }, ctx),
            );
          for (const origin of [
            { actorId: b.userId },
            { actorId: a.userId, deviceId: randomUUID() },
            { actorId: a.userId, channel: "INVALID" },
            { actorId: a.userId, requestId: "x".repeat(101) },
          ])
            await assert.rejects(
              statusWriter.setStatus(
                { tenantId: a.tenantId, actorId: a.userId },
                original.id,
                { status: "INACTIVE" },
                { ...ctx, origin },
              ),
            );
          for (const field of ["name", "tenantId", "items", "itemStatus", "parentId"])
            await denied(
              command.execute(original.id, { status: "INACTIVE", [field]: "Changed" }, ctx),
              "VALIDATION_ERROR",
              400,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "lifecycle stays internal and standalone without extra usage/outbox/installation or Catalog/POS/KDS writes",
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
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
