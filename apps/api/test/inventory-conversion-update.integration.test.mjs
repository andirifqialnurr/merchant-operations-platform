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
  conversion,
  denied,
  fixture,
  scopeOf,
  snapshot,
} from "./inventory-conversion-update-fixture.mjs";

const maxFactor = "999999999999999999.999999999999";

test("authorized factor update keeps immutable binding and atomically commits safe audit/replay", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, updater, command } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "factor-only DTO, original pair, attributed critical audit and status-200 result agree",
        async () => {
          const original = await conversion(db, a);
          const parentsBefore = await db.inventoryUnit.findMany({
            where: { tenantId: a.tenantId },
            orderBy: { id: "asc" },
          });
          const ctx = attempt(a);
          const result = await command.execute(original.id, { factor: "2.500000" }, ctx);
          assert.deepEqual(result, {
            id: original.id,
            fromUnitId: original.fromUnitId,
            toUnitId: original.toUnitId,
            factor: "2.5",
          });
          assert.deepEqual(Object.keys(result).sort(), ["factor", "fromUnitId", "id", "toUnitId"]);
          const row = await db.inventoryUnitConversion.findUniqueOrThrow({
            where: { id: original.id },
          });
          assert.equal(row.tenantId, a.tenantId);
          assert.equal(row.createdAt.getTime(), original.createdAt.getTime());
          assert.equal(row.factor.toFixed(), "2.5");
          assert.deepEqual(
            await db.inventoryUnit.findMany({
              where: { tenantId: a.tenantId },
              orderBy: { id: "asc" },
            }),
            parentsBefore,
          );
          const audit = await db.auditLog.findFirstOrThrow({
            where: {
              tenantId: a.tenantId,
              entityId: original.id,
              action: "inventory.unit_conversion.update",
            },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.outletId, null);
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.equal(audit.correlationId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, {
            critical: true,
            fromUnitId: original.fromUnitId,
            toUnitId: original.toUnitId,
            before: { factor: "1000" },
            after: { factor: "2.5" },
          });
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(record.status, "COMPLETED");
          assert.equal(record.responseStatus, 200);
          assert.equal(record.outletId, null);
          assert.deepEqual(record.responseBody, result);
          assert.equal(
            await db.inventoryUnitConversion.count({
              where: {
                tenantId: a.tenantId,
                fromUnitId: original.toUnitId,
                toUnitId: original.fromUnitId,
              },
            }),
            0,
          );
        },
      );

      await t.test(
        "all known dimensions accept tiny/max/unsafe-integer exact factors even with unit precision zero",
        async () => {
          for (const dimension of ["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"]) {
            const original = await conversion(db, a, "1", dimension, 0);
            for (const factor of ["0.000000000001", maxFactor, "9007199254740993.000001"]) {
              const result = await command.execute(original.id, { factor }, attempt(a));
              assert.equal(result.factor, factor);
              assert.equal(
                (
                  await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: original.id } })
                ).factor.toFixed(),
                factor,
              );
              assert.equal(result.fromUnitId, original.fromUnitId);
              assert.equal(result.toUnitId, original.toUnitId);
            }
          }
        },
      );

      await t.test(
        "foreign and absent target share a private 404 without row/audit/key side effects",
        async () => {
          const foreign = await conversion(db, b);
          const beforeA = await snapshot(db, a.tenantId);
          const beforeB = await snapshot(db, b.tenantId);
          for (const id of [foreign.id, randomUUID()])
            await denied(
              command.execute(id, { factor: "1" }, attempt(a)),
              "INVENTORY_CONVERSION_NOT_FOUND",
              404,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), beforeA);
          assert.deepEqual(await snapshot(db, b.tenantId), beforeB);
        },
      );

      await t.test(
        "canonical no-op retains timestamp/audit and reserves a snapshot that is never reapplied",
        async () => {
          const original = await conversion(db, a, "1000.000000");
          const ctx = attempt(a);
          const first = await command.execute(original.id, { factor: "1000.0000" }, ctx);
          assert.equal(first.factor, "1000");
          assert.deepEqual(
            await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: original.id } }),
            original,
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.unit_conversion.update",
              },
            }),
            0,
          );
          await command.execute(original.id, { factor: "2" }, attempt(a));
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(await command.execute(original.id, { factor: "1000" }, ctx), first);
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "eight same-key attempts produce one mutation audit and one original result",
        async () => {
          const original = await conversion(db, a);
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              command.execute(original.id, { factor: "12.500" }, ctx),
            ),
          );
          assert.ok(
            results.every((result) => result.id === original.id && result.factor === "12.5"),
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.unit_conversion.update",
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
        "fresh permission/scope/device/capability/install/subscription/membership checks precede replay",
        async () => {
          const original = await conversion(db, a);
          const ctx = attempt(a);
          const patch = { factor: "2" };
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
          facts.capabilities.clear();
          await denied(command.execute(original.id, patch, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.capabilities.add("inventory.item.manage");
          facts.installation = "SETUP_REQUIRED";
          await denied(command.execute(original.id, patch, ctx), "INSTALLATION_SETUP_REQUIRED");
          facts.installation = "ACTIVE";
          facts.subscriptionUsable = false;
          await denied(command.execute(original.id, patch, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          facts.subscriptionUsable = true;
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "INACTIVE" },
          });
          await denied(command.execute(original.id, patch, ctx), "WORKSPACE_ACCESS_DENIED", 403);
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "ACTIVE" },
          });
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
        },
      );

      await t.test(
        "audit/result/completion faults roll back factor/timestamp/audit/key and permit retry after rollback",
        async () => {
          for (const stage of ["audit", "result", "completion"]) {
            const original = await conversion(db, a);
            const ctx = attempt(a);
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "result"
                  ? "inventory_unit_conversions"
                  : "idempotency_keys";
            const event = stage === "audit" ? "INSERT" : "UPDATE";
            const action =
              stage === "result" ? "NEW.factor := 999;" : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_factor_update_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_factor_update_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_factor_update_failure();`);
            try {
              if (stage === "result")
                await denied(
                  command.execute(original.id, { factor: "7" }, ctx),
                  "IDEMPOTENCY_RESULT_UNAVAILABLE",
                );
              else await assert.rejects(command.execute(original.id, { factor: "7" }, ctx));
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_factor_update_failure ON ${table}; DROP FUNCTION test_factor_update_failure()`,
              );
            }
            assert.equal((await command.execute(original.id, { factor: "7" }, ctx)).factor, "7");
          }
        },
      );

      await t.test(
        "invalid scope/origin/metadata never broadens update and Inventory remains unregistered/standalone",
        async () => {
          const original = await conversion(db, a);
          const ctx = attempt(a);
          const before = await snapshot(db, a.tenantId);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(updater.update(scope, original.id, { factor: "1" }, ctx));
          await assert.rejects(
            updater.update(
              { tenantId: a.tenantId, actorId: a.userId },
              original.id,
              { factor: "1" },
              { ...ctx, origin: { actorId: b.userId } },
            ),
          );
          for (const field of ["fromUnitId", "toUnitId", "tenantId", "dimension", "status"])
            await denied(
              command.execute(original.id, { factor: "1", [field]: randomUUID() }, ctx),
              "VALIDATION_ERROR",
              400,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.equal(await db.outboxEvent.count(), outboxBefore);
          for (const delegate of [
            db.coreModuleInstallation,
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
