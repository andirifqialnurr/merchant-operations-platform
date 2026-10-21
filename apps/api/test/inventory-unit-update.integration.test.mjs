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
  denied,
  fixture,
  scopeOf,
  snapshot,
  unit,
} from "./inventory-unit-update-fixture.mjs";

test("authorized Inventory unit patch commits only owned fields with audit and original result", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, command, updater } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "partial update preserves omitted fields/dimension and returns safe attributed audit/key",
        async () => {
          const original = await unit(db, a);
          const ctx = attempt(a);
          const result = await command.execute(original.id, { name: " Updated name " }, ctx);
          assert.deepEqual(result, {
            id: original.id,
            code: original.code,
            name: "Updated name",
            precision: 6,
            dimension: "MASS",
          });
          const audit = await db.auditLog.findFirstOrThrow({
            where: { tenantId: a.tenantId, action: "inventory.unit.update", entityId: original.id },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.outletId, null);
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.equal(audit.correlationId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, {
            critical: true,
            before: { code: original.code, precision: 6 },
            after: { code: original.code, precision: 6 },
            nameChanged: true,
          });
          assert.ok(!JSON.stringify(audit).includes("Updated name"));
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(record.status, "COMPLETED");
          assert.equal(record.outletId, null);
          assert.equal(record.responseStatus, 200);
          assert.deepEqual(record.responseBody, result);
          const changed = await command.execute(
            original.id,
            { code: " gram ", precision: 0 },
            attempt(a),
          );
          assert.deepEqual(changed, { ...result, code: "gram", precision: 0 });
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } }))
              .definitionLocked,
            false,
          );
        },
      );

      await t.test(
        "item/conversion references block code/precision changes but still permit label correction",
        async () => {
          for (const source of ["item", "conversion"]) {
            const original = await unit(db, a);
            if (source === "item")
              await db.inventoryItem.create({
                data: {
                  tenantId: a.tenantId,
                  name: "Item",
                  baseUnitId: original.id,
                  minStock: "0.000001",
                },
              });
            else {
              const target = await unit(db, a);
              await db.inventoryUnitConversion.create({
                data: {
                  tenantId: a.tenantId,
                  fromUnitId: original.id,
                  toUnitId: target.id,
                  factor: "1000",
                },
              });
            }
            for (const patch of [
              { precision: 0 },
              { code: original.code.toUpperCase() },
              { code: "other", name: "Changed" },
            ]) {
              const before = await snapshot(db, a.tenantId);
              await denied(
                command.execute(original.id, patch, attempt(a)),
                "INVENTORY_UNIT_DEFINITION_LOCKED",
              );
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            }
            const result = await command.execute(
              original.id,
              { name: "Corrected", code: original.code, precision: 6 },
              attempt(a),
            );
            assert.equal(result.name, "Corrected");
            assert.equal(result.precision, 6);
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } }))
                .definitionLocked,
              true,
            );
          }
        },
      );

      await t.test(
        "foreign/missing targets share a private 404 without reservation/audit or foreign mutation",
        async () => {
          const foreign = await unit(db, b);
          const before = await snapshot(db, a.tenantId);
          for (const id of [foreign.id, randomUUID()])
            await denied(
              command.execute(id, { name: "Hidden" }, attempt(a)),
              "INVENTORY_UNIT_NOT_FOUND",
              404,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.inventoryUnit.findUniqueOrThrow({ where: { id: foreign.id } }),
            foreign,
          );
        },
      );

      await t.test(
        "CI code conflicts/races leave one winner and no failed key or stale other-field writes",
        async () => {
          const one = await unit(db, a);
          const two = await unit(db, a);
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute(
              two.id,
              { code: one.code.toUpperCase(), name: "Should roll back", precision: 0 },
              attempt(a),
            ),
            "INVENTORY_UNIT_CODE_TAKEN",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          const contexts = [attempt(a), attempt(a)];
          const code = `r${randomUUID().slice(0, 12)}`;
          const results = await Promise.allSettled([
            command.execute(one.id, { code }, contexts[0]),
            command.execute(two.id, { code: code.toUpperCase() }, contexts[1]),
          ]);
          assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
          assert.equal(
            results.find((result) => result.status === "rejected").reason.getResponse().code,
            "INVENTORY_UNIT_CODE_TAKEN",
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
        },
      );

      await t.test(
        "eight same-key updates return one original snapshot and one mutation audit",
        async () => {
          const original = await unit(db, a);
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () => command.execute(original.id, { name: "Once" }, ctx)),
          );
          assert.ok(results.every((result) => result.name === "Once" && result.id === original.id));
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                action: "inventory.unit.update",
                entityId: original.id,
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
        "no-op retains timestamp, omits mutation audit, reserves result and never reapplies after a later change",
        async () => {
          const original = await unit(db, a);
          await db.inventoryItem.create({
            data: { tenantId: a.tenantId, name: "Use", baseUnitId: original.id },
          });
          const before = await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } });
          const ctx = attempt(a);
          const result = await command.execute(
            original.id,
            { code: original.code, precision: original.precision, name: original.name },
            ctx,
          );
          assert.deepEqual(
            await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } }),
            before,
          );
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                action: "inventory.unit.update",
                entityId: original.id,
              },
            }),
            0,
          );
          await command.execute(original.id, { name: "Later" }, attempt(a));
          const after = await snapshot(db, a.tenantId);
          assert.deepEqual(
            await command.execute(
              original.id,
              { code: original.code, precision: original.precision, name: original.name },
              ctx,
            ),
            result,
          );
          assert.deepEqual(await snapshot(db, a.tenantId), after);
        },
      );

      await t.test(
        "fresh permission/scope/device/capability/install/subscription/membership refusal precedes replay",
        async () => {
          const original = await unit(db, a);
          const ctx = attempt(a);
          const patch = { name: "Guarded" };
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
        "audit/result/completion failure rolls back the row/timestamp/audit/key together",
        async () => {
          for (const stage of ["audit", "result", "completion"]) {
            const original = await unit(db, a);
            const ctx = attempt(a);
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "result"
                  ? "inventory_units"
                  : "idempotency_keys";
            const event = stage === "audit" ? "INSERT" : "UPDATE";
            const action =
              stage === "result"
                ? "NEW.name := 'unexpected';"
                : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_unit_update_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_unit_update_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_unit_update_failure();`);
            try {
              if (stage === "result")
                await denied(
                  command.execute(original.id, { name: "Wanted" }, ctx),
                  "IDEMPOTENCY_RESULT_UNAVAILABLE",
                );
              else await assert.rejects(command.execute(original.id, { name: "Wanted" }, ctx));
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_unit_update_failure ON ${table}; DROP FUNCTION test_unit_update_failure()`,
              );
            }
            assert.equal(
              (await command.execute(original.id, { name: "Wanted" }, ctx)).name,
              "Wanted",
            );
          }
        },
      );

      await t.test(
        "internal invalid scope/origin cannot broaden a write; dimension/status/body metadata cannot bypass it",
        async () => {
          const original = await unit(db, a);
          const ctx = attempt(a);
          const before = await snapshot(db, a.tenantId);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(updater.update(scope, original.id, { name: "Bad" }, ctx));
          await assert.rejects(
            updater.update(
              { tenantId: a.tenantId, actorId: a.userId },
              original.id,
              { name: "Bad" },
              { ...ctx, origin: { actorId: b.userId } },
            ),
          );
          for (const field of ["dimension", "definitionLocked", "tenantId", "status"])
            await denied(
              command.execute(original.id, { name: "Bad", [field]: "MASS" }, ctx),
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
