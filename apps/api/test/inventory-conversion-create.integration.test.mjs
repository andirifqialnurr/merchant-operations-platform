import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaInventoryUnitWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-writer.ts";
import {
  absent,
  attempt,
  denied,
  fixture,
  pair,
  scopeOf,
  waitForBlocked,
} from "./inventory-conversion-fixture.mjs";

const maxFactor = "999999999999999999.999999999999";

test("create direct conversion scopes stable compatible parents and commits audit/replay atomically", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database, createClient }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, facts, writer, command } = await fixture(db);
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "exact DTO/factor, both parent latches and critical attributed audit/key are one result",
        async () => {
          const body = await pair(db, a.tenantId);
          const ctx = attempt(a);
          const result = await command.execute(body, ctx);
          assert.deepEqual(result, { ...body, id: result.id });
          assert.deepEqual(Object.keys(result).sort(), ["factor", "fromUnitId", "id", "toUnitId"]);
          assert.equal(
            await db.inventoryUnit.count({
              where: {
                tenantId: a.tenantId,
                id: { in: [body.fromUnitId, body.toUnitId] },
                definitionLocked: true,
              },
            }),
            2,
          );
          const audit = await db.auditLog.findFirstOrThrow({
            where: { tenantId: a.tenantId, entityId: result.id },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.outletId, null);
          assert.equal(audit.action, "inventory.unit_conversion.create");
          assert.equal(audit.entityType, "inventory_unit_conversion");
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.equal(audit.correlationId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, { critical: true, after: body });
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(record.outletId, null);
          assert.equal(record.status, "COMPLETED");
          assert.equal(record.responseStatus, 201);
          assert.deepEqual(record.responseBody, result);
          assert.match(record.requestHash, /^[a-f0-9]{64}$/);
          // Direction is explicit: no reciprocal is generated.
          assert.equal(
            await db.inventoryUnitConversion.count({
              where: { tenantId: a.tenantId, fromUnitId: body.toUnitId, toUnitId: body.fromUnitId },
            }),
            0,
          );
        },
      );

      await t.test(
        "all known dimensions support tiny/max exact factors independent of quantity precision",
        async () => {
          for (const dimension of ["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"]) {
            for (const factor of ["0.000000000001", maxFactor]) {
              const body = { ...(await pair(db, a.tenantId, [dimension, dimension], 0)), factor };
              const result = await command.execute(body, attempt(a));
              assert.equal(result.factor, factor);
              assert.equal(
                (
                  await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: result.id } })
                ).factor.toFixed(),
                factor,
              );
            }
          }
        },
      );

      await t.test(
        "normalized case/decimal/key replays original snapshot after factor correction",
        async () => {
          const body = await pair(db, a.tenantId);
          const key = `normalized:${randomUUID()}`;
          const first = await command.execute(
            { ...body, fromUnitId: body.fromUnitId.toUpperCase(), factor: "1000.000000000000" },
            attempt(a, ` ${key} `),
          );
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key },
          });
          await db.inventoryUnitConversion.update({
            where: { id: first.id },
            data: { factor: "999" },
          });
          assert.deepEqual(
            await command.execute(
              {
                factor: "1000",
                toUnitId: body.toUnitId.toUpperCase(),
                fromUnitId: body.fromUnitId,
              },
              attempt(a, key),
            ),
            first,
          );
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
          assert.equal(
            await db.auditLog.count({ where: { tenantId: a.tenantId, entityId: first.id } }),
            1,
          );
          await denied(
            command.execute({ ...body, factor: "999" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
          await denied(
            command.execute(
              { ...body, fromUnitId: body.toUnitId, toUnitId: body.fromUnitId },
              attempt(a, key),
            ),
            "IDEMPOTENCY_KEY_REUSED",
          );
        },
      );

      await t.test("eight same-key attempts produce one conversion/audit/result", async () => {
        const body = await pair(db, a.tenantId);
        const ctx = attempt(a);
        const results = await Promise.all(
          Array.from({ length: 8 }, () => command.execute(body, ctx)),
        );
        assert.equal(new Set(results.map((row) => row.id)).size, 1);
        assert.equal(
          await db.auditLog.count({ where: { tenantId: a.tenantId, entityId: results[0].id } }),
          1,
        );
        assert.equal(
          await db.idempotencyKey.count({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          }),
          1,
        );
      });

      await t.test(
        "different-key pair race conflicts atomically; explicit reverse pairs do not deadlock",
        async () => {
          const body = await pair(db, a.tenantId);
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.allSettled(
            contexts.map((ctx) => command.execute(body, ctx)),
          );
          assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
          assert.equal(
            results.find((row) => row.status === "rejected").reason.getResponse().code,
            "INVENTORY_CONVERSION_PAIR_TAKEN",
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
          const other = await pair(db, a.tenantId);
          const [forward, reverse] = await Promise.all([
            command.execute(other, attempt(a)),
            command.execute(
              { fromUnitId: other.toUnitId, toUnitId: other.fromUnitId, factor: "0.001" },
              attempt(a),
            ),
          ]);
          assert.notEqual(forward.id, reverse.id);
          assert.equal(reverse.factor, "0.001");
        },
      );

      await t.test(
        "missing/cross-workspace parents share private 404 and incompatible dimensions leave no latch/key/audit",
        async () => {
          const local = await pair(db, a.tenantId);
          const foreign = await pair(db, b.tenantId);
          for (const body of [
            { ...local, fromUnitId: randomUUID() },
            { ...local, toUnitId: randomUUID() },
            { ...local, fromUnitId: foreign.fromUnitId },
            { ...local, toUnitId: foreign.toUnitId },
            foreign,
          ]) {
            const ctx = attempt(a);
            await denied(command.execute(body, ctx), "INVENTORY_UNIT_NOT_FOUND", 404);
            await absent(db, a, body, ctx);
          }
          const incompatible = await pair(db, a.tenantId, ["MASS", "VOLUME"]);
          const ctx = attempt(a);
          await denied(
            command.execute(incompatible, ctx),
            "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
          );
          await absent(db, a, incompatible, ctx);
          assert.equal(
            await db.inventoryUnit.count({
              where: { tenantId: b.tenantId, definitionLocked: true },
            }),
            0,
          );
        },
      );

      await t.test(
        "actor/tenant/operation isolation prevents replay of another caller's result",
        async () => {
          const key = `shared:${randomUUID()}`;
          const unitResult = await new PrismaInventoryUnitWriter().create(
            { tenantId: a.tenantId, actorId: a.userId },
            {
              code: `op${randomUUID().slice(0, 12)}`,
              name: "Operation isolation",
              precision: 0,
              dimension: "COUNT",
            },
            attempt(a, key),
          );
          const unitRecord = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: `inventory.unit.create:${a.userId}`, key },
          });
          const body = await pair(db, a.tenantId);
          const first = await command.execute(body, attempt(a, key));
          const foreignBody = await pair(db, b.tenantId);
          const foreign = await command.execute(foreignBody, attempt(b, key));
          assert.notEqual(first.id, foreign.id);
          // A second all-outlet owner is independently authorized but cannot replay actor A.
          const user = await db.user.create({
            data: {
              displayName: "Other",
              email: "conversion-other@example.test",
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
            command.execute(body, attempt(other, key)),
            "INVENTORY_CONVERSION_PAIR_TAKEN",
          );
          assert.equal(
            await db.idempotencyKey.count({
              where: { tenantId: a.tenantId, scope: scopeOf(other), key },
            }),
            0,
          );
          assert.notEqual(first.id, unitResult.id);
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: unitRecord.id } }),
            unitRecord,
          );
        },
      );

      await t.test(
        "permission/scope/device/membership/capability/install refusal precedes even saved replay",
        async () => {
          const body = await pair(db, a.tenantId);
          const ctx = attempt(a);
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
          facts.capabilities.clear();
          await denied(command.execute(body, ctx), "ENTITLEMENT_REQUIRED", 403);
          facts.capabilities.add("inventory.item.manage");
          facts.installation = "SETUP_REQUIRED";
          await denied(command.execute(body, ctx), "INSTALLATION_SETUP_REQUIRED");
          facts.installation = "ACTIVE";
          facts.subscriptionUsable = false;
          await denied(command.execute(body, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          facts.subscriptionUsable = true;
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "INACTIVE" },
          });
          await denied(command.execute(body, ctx), "WORKSPACE_ACCESS_DENIED", 403);
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
        "audit/result/completion failure rolls back conversion, BOTH latches and key",
        async () => {
          for (const stage of ["audit", "result", "completion"]) {
            const body = { ...(await pair(db, a.tenantId)), factor: "7" };
            const ctx = attempt(a);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "result"
                  ? "inventory_unit_conversions"
                  : "idempotency_keys";
            const event = stage === "completion" ? "UPDATE" : "INSERT";
            const action =
              stage === "result" ? "NEW.factor := 8;" : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_conversion_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_conversion_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_conversion_failure();`);
            try {
              if (stage === "result")
                await denied(command.execute(body, ctx), "IDEMPOTENCY_RESULT_UNAVAILABLE");
              else await assert.rejects(command.execute(body, ctx));
              await absent(db, a, body, ctx);
            } finally {
              await database.query(
                `DROP TRIGGER test_conversion_failure ON ${table}; DROP FUNCTION test_conversion_failure()`,
              );
            }
            assert.ok((await command.execute(body, ctx)).id);
          }
        },
      );

      await t.test(
        "uncertain/expired/corrupt/foreign or wrong-pair saved results never execute a new mutation",
        async () => {
          const body = await pair(db, a.tenantId);
          const ctx = attempt(a);
          const result = await command.execute(body, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          const other = await command.execute(await pair(db, a.tenantId), attempt(a));
          const foreign = await command.execute(await pair(db, b.tenantId), attempt(b));
          const counts = [await db.inventoryUnitConversion.count(), await db.auditLog.count()];
          for (const [data, expected] of [
            [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
            [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
            [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
            [{ responseStatus: null }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, factor: "999" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, factor: "1000.0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [
              { responseBody: { ...result, tenantId: a.tenantId } },
              "IDEMPOTENCY_RESULT_UNAVAILABLE",
            ],
            [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: other.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
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
            [await db.inventoryUnitConversion.count(), await db.auditLog.count()],
            counts,
          );
        },
      );

      await t.test(
        "both parent definitions stay locked through audit and until commit",
        async () => {
          const body = await pair(db, a.tenantId);
          const barrier = createClient();
          const editor = createClient();
          await barrier.connect();
          await editor.connect();
          let pending;
          let edit;
          try {
            await barrier.query("SELECT pg_advisory_lock(846293)");
            const blocker = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            await database.query(`CREATE FUNCTION test_conversion_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.unit_conversion.create' THEN PERFORM pg_advisory_xact_lock(846293); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_conversion_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_conversion_barrier();`);
            pending = command.execute(body, attempt(a)).then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            const writerPid = await waitForBlocked(database, blocker);
            edit = editor
              .query("UPDATE inventory_units SET precision = 0 WHERE id = $1", [body.toUnitId])
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            await waitForBlocked(database, writerPid);
            await barrier.query("SELECT pg_advisory_unlock(846293)");
            assert.ok((await pending).value);
            assert.equal((await edit).error?.constraint, "inventory_units_definition_check");
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: body.toUnitId } }))
                .precision,
              6,
            );
          } finally {
            await barrier.query("SELECT pg_advisory_unlock_all()");
            await pending;
            await edit;
            await database.query(
              "DROP TRIGGER IF EXISTS test_conversion_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_conversion_barrier()",
            );
            await barrier.end();
            await editor.end();
          }
        },
      );

      await t.test(
        "internal invalid scope/origin never becomes unscoped IO; no module/outbox activation",
        async () => {
          const body = await pair(db, a.tenantId);
          const ctx = attempt(a);
          for (const scope of [
            { tenantId: undefined, actorId: a.userId },
            { tenantId: a.tenantId, actorId: undefined },
          ])
            await assert.rejects(writer.create(scope, body, ctx));
          await assert.rejects(
            writer.create({ tenantId: a.tenantId, actorId: a.userId }, body, {
              ...ctx,
              origin: { actorId: b.userId },
            }),
          );
          await denied(
            command.execute({ ...body, tenantId: b.tenantId }, ctx),
            "VALIDATION_ERROR",
            400,
          );
          await absent(db, a, body, ctx);
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
