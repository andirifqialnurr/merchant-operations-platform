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
} from "./inventory-category-update-fixture.mjs";

test("category rename owns only name and atomically commits safe audit/original replay under fresh master access", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, updater, command } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();
      const usageBefore = await db.coreUsageEvent.count();

      await t.test(
        "ACTIVE and INACTIVE label corrections retain status/identity/item relations with narrow attributed audit/result",
        async () => {
          for (const status of ["ACTIVE", "INACTIVE"]) {
            const original = await category(db, a, { status });
            const unit = await db.inventoryUnit.create({
              data: {
                tenantId: a.tenantId,
                code: `u${randomUUID().slice(0, 12)}`,
                name: "Unit",
                precision: 6,
                dimension: "MASS",
              },
            });
            const item = await db.inventoryItem.create({
              data: {
                tenantId: a.tenantId,
                name: "Linked item",
                categoryId: original.id,
                baseUnitId: unit.id,
                minStock: "1.000001",
              },
            });
            const ctx = attempt(a);
            const result = await command.execute(
              original.id,
              { name: ` Corrected ${status} ` },
              ctx,
            );
            assert.deepEqual(result, { id: original.id, name: `Corrected ${status}`, status });
            assert.deepEqual(Object.keys(result).sort(), ["id", "name", "status"]);
            const row = await db.inventoryCategory.findUniqueOrThrow({
              where: { id: original.id },
            });
            assert.equal(row.tenantId, original.tenantId);
            assert.equal(row.createdAt.getTime(), original.createdAt.getTime());
            assert.equal(row.status, status);
            assert.deepEqual(
              await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }),
              item,
            );
            const audit = await db.auditLog.findFirstOrThrow({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.update",
              },
            });
            assert.equal(audit.actorId, a.userId);
            assert.equal(audit.entityType, "inventory_category");
            assert.equal(audit.outletId, null);
            assert.equal(audit.channel, "WEB");
            assert.equal(audit.requestId, ctx.origin.requestId);
            assert.equal(audit.correlationId, ctx.origin.requestId);
            assert.deepEqual(audit.metadata, { critical: true, nameChanged: true });
            assert.ok(!JSON.stringify(audit).includes(result.name));
            assert.ok(!JSON.stringify(audit).includes(original.name));
            const record = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            });
            assert.equal(record.outletId, null);
            assert.equal(record.status, "COMPLETED");
            assert.equal(record.responseStatus, 200);
            assert.deepEqual(record.responseBody, result);
          }
        },
      );

      await t.test(
        "foreign/missing target gives the same private 404 and leaves tenant state/key/audit unchanged",
        async () => {
          const foreign = await category(db, b);
          const beforeA = await snapshot(db, a.tenantId);
          const beforeB = await snapshot(db, b.tenantId);
          for (const target of [foreign.id, randomUUID()])
            await denied(
              command.execute(target, { name: "Not allowed" }, attempt(a)),
              "INVENTORY_CATEGORY_NOT_FOUND",
              404,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), beforeA);
          assert.deepEqual(await snapshot(db, b.tenantId), beforeB);
        },
      );

      await t.test(
        "CI conflicts/races include inactive names without overwriting status; own casing correction is a real rename",
        async () => {
          const original = await category(db, a);
          const reserved = await category(db, a, { name: "Reserved name", status: "INACTIVE" });
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute(original.id, { name: " RESERVED NAME " }, attempt(a)),
            "INVENTORY_CATEGORY_NAME_TAKEN",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.inventoryCategory.findUniqueOrThrow({ where: { id: reserved.id } }),
            reserved,
          );
          const second = await category(db, a);
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.allSettled([
            command.execute(original.id, { name: "Race rename" }, contexts[0]),
            command.execute(second.id, { name: "RACE RENAME" }, contexts[1]),
          ]);
          assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
          assert.equal(
            results.find((row) => row.status === "rejected").reason.getResponse().code,
            "INVENTORY_CATEGORY_NAME_TAKEN",
          );
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
          const own = await category(db, a, { name: "Casing label" });
          assert.equal(
            (await command.execute(own.id, { name: "CASING LABEL" }, attempt(a))).name,
            "CASING LABEL",
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: own.id,
                action: "inventory.category.update",
              },
            }),
            1,
          );
        },
      );

      await t.test(
        "eight same-key attempts produce one rename audit and one completed original result",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              command.execute(original.id, { name: "Once only" }, ctx),
            ),
          );
          assert.ok(results.every((row) => row.id === original.id && row.name === "Once only"));
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.update",
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
        "no-op keeps row/timestamp/audit untouched but reserves its original result against later rename/status changes",
        async () => {
          const original = await category(db, a, { name: "No-op original", status: "INACTIVE" });
          const ctx = attempt(a);
          const first = await command.execute(original.id, { name: " No-op original " }, ctx);
          assert.deepEqual(
            await db.inventoryCategory.findUniqueOrThrow({ where: { id: original.id } }),
            original,
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.update",
              },
            }),
            0,
          );
          await command.execute(original.id, { name: "No-op later" }, attempt(a));
          await db.inventoryCategory.update({
            where: { id: original.id },
            data: { status: "ACTIVE" },
          });
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(
            await command.execute(original.id, { name: "No-op original" }, ctx),
            first,
          );
          assert.equal(first.status, "INACTIVE");
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "fresh permission/all-outlet/device/membership/user/subscription/module/install/capability denials precede replay",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const patch = { name: "Guarded rename" };
          await command.execute(original.id, patch, ctx);
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
          await denied(command.execute(original.id, patch, ctx), "PERMISSION_DENIED", 403);
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
          await denied(command.execute(original.id, patch, ctx), "LOCATION_SCOPE_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: true },
          });
          await denied(
            command.execute(original.id, patch, {
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
          await denied(command.execute(original.id, patch, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "ACTIVE" },
          });
          await db.user.update({ where: { id: a.userId }, data: { status: "DISABLED" } });
          await denied(command.execute(original.id, patch, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.user.update({ where: { id: a.userId }, data: { status: "ACTIVE" } });
          facts.subscriptionUsable = false;
          await denied(command.execute(original.id, patch, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          facts.subscriptionUsable = true;
          facts.module.entitled = false;
          await denied(command.execute(original.id, patch, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.module.entitled = true;
          facts.capabilities.clear();
          await denied(command.execute(original.id, patch, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.capabilities.add("inventory.item.manage");
          for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
            facts.installation = installation;
            await denied(command.execute(original.id, patch, ctx), "INSTALLATION_SETUP_REQUIRED");
          }
          facts.installation = "ACTIVE";
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
        },
      );

      await t.test(
        "audit/result-name/result-status/completion faults roll back name/status/timestamp/audit/key together",
        async () => {
          for (const stage of ["audit", "result_name", "result_status", "completion"]) {
            const original = await category(db, a);
            const ctx = attempt(a);
            const patch = { name: `Wanted ${stage}` };
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
                ? "NEW.name := 'unexpected rename';"
                : stage === "result_status"
                  ? "NEW.status := 'INACTIVE';"
                  : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_category_update_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_category_update_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_category_update_failure();`);
            try {
              if (stage.startsWith("result"))
                await denied(
                  command.execute(original.id, patch, ctx),
                  "IDEMPOTENCY_RESULT_UNAVAILABLE",
                );
              else await assert.rejects(command.execute(original.id, patch, ctx));
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_category_update_failure ON ${table}; DROP FUNCTION test_category_update_failure()`,
              );
            }
            assert.equal((await command.execute(original.id, patch, ctx)).name, patch.name);
          }
        },
      );

      await t.test(
        "invalid internal scope/origin and client status/relation fields cannot widen writes or activate the module",
        async () => {
          const original = await category(db, a);
          const ctx = attempt(a);
          const before = await snapshot(db, a.tenantId);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(
              updater.update(scope, original.id, { name: "Invalid scope" }, ctx),
            );
          for (const origin of [
            { actorId: b.userId },
            { actorId: a.userId, deviceId: randomUUID() },
            { actorId: a.userId, channel: "INVALID" },
            { actorId: a.userId, requestId: "x".repeat(101) },
          ])
            await assert.rejects(
              updater.update(
                { tenantId: a.tenantId, actorId: a.userId },
                original.id,
                { name: "Invalid origin" },
                { ...ctx, origin },
              ),
            );
          for (const field of ["status", "tenantId", "parentId", "items"])
            await denied(
              command.execute(original.id, { name: "Invalid field", [field]: "ACTIVE" }, ctx),
              "VALIDATION_ERROR",
              400,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.equal(await db.outboxEvent.count(), outboxBefore);
          assert.equal(await db.coreUsageEvent.count(), usageBefore);
          for (const delegate of [
            db.coreModuleInstallation,
            db.catalogCategory,
            db.catalogProduct,
            db.order,
            db.kdsTicket,
          ])
            assert.equal(await delegate.count({ where: { tenantId: a.tenantId } }), 0);
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
