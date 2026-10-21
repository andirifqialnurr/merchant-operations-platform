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
  unit,
} from "./inventory-item-create-fixture.mjs";

const activeCount = (db, a) =>
  db.inventoryItem.count({ where: { tenantId: a.tenantId, status: "ACTIVE" } });

test("authorized item creation commits scoped parents, hard count, reference latch, audit and original replay atomically", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const f = await fixture(db);
      const { a, b, command, maxima, facts } = f;
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "new ACTIVE item returns seven fields, exact threshold, one critical attributed audit/key and latches only its unit",
        async () => {
          const base = await unit(db, a);
          const group = await category(db, a);
          const body = {
            name: " Flour ",
            sku: " FL-1 ",
            categoryId: group.id.toUpperCase(),
            baseUnitId: base.id.toUpperCase(),
            minStock: "0.000001",
          };
          const ctx = attempt(a);
          const result = await command.execute(body, ctx);
          assert.deepEqual(Object.keys(result).sort(), [
            "baseUnitId",
            "categoryId",
            "id",
            "minStock",
            "name",
            "sku",
            "status",
          ]);
          assert.deepEqual(result, {
            id: result.id,
            name: "Flour",
            sku: "FL-1",
            categoryId: group.id,
            baseUnitId: base.id,
            minStock: "0.000001",
            status: "ACTIVE",
          });
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: base.id } })).definitionLocked,
            true,
          );
          const audit = await db.auditLog.findFirstOrThrow({
            where: { entityId: result.id, action: "inventory.item.create" },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.tenantId, a.tenantId);
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, {
            critical: true,
            after: { status: "ACTIVE", baseUnitId: base.id, categoryId: group.id },
          });
          const key = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(key.status, "COMPLETED");
          assert.equal(key.responseStatus, 201);
          assert.deepEqual(key.responseBody, result);
        },
      );

      await t.test(
        "optional unknowns stay null, explicit zero and maximal exact threshold remain distinct, names and null SKUs are not invented uniqueness rules",
        async () => {
          const base = await unit(db, a);
          for (const minStock of [undefined, null, "0", "999999999999999999999999.999999"]) {
            const result = await command.execute(
              {
                name: "Repeated item label",
                baseUnitId: base.id,
                ...(minStock === undefined ? {} : { minStock }),
              },
              attempt(a),
            );
            assert.equal(result.sku, null);
            assert.equal(result.categoryId, null);
            assert.equal(result.minStock, minStock ?? null);
          }
          const whole = await unit(db, a, 0);
          assert.equal(
            (
              await command.execute(
                { name: "Whole", baseUnitId: whole.id, minStock: "1.000000" },
                attempt(a),
              )
            ).minStock,
            "1",
          );
        },
      );

      await t.test(
        "missing/foreign parents share safe 404 and inactive category or meaningful excess precision leave no item/latch/audit/key",
        async () => {
          const base = await unit(db, a, 0);
          const foreignBase = await unit(db, b);
          const foreignGroup = await category(db, b);
          const inactive = await category(db, a, { status: "INACTIVE" });
          const before = await snapshot(db, a.tenantId);
          const otherBefore = await snapshot(db, b.tenantId);
          for (const [patch, code, status] of [
            [{ baseUnitId: randomUUID() }, "INVENTORY_UNIT_NOT_FOUND", 404],
            [{ baseUnitId: foreignBase.id }, "INVENTORY_UNIT_NOT_FOUND", 404],
            [{ categoryId: randomUUID() }, "INVENTORY_CATEGORY_NOT_FOUND", 404],
            [{ categoryId: foreignGroup.id }, "INVENTORY_CATEGORY_NOT_FOUND", 404],
            [{ categoryId: inactive.id }, "INVENTORY_CATEGORY_INACTIVE", 409],
            [{ minStock: "0.1" }, "INVENTORY_MINIMUM_PRECISION_EXCEEDED", 409],
          ])
            await denied(
              command.execute(
                { name: "Invalid parent", baseUnitId: base.id, ...patch },
                attempt(a),
              ),
              code,
              status,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(await snapshot(db, b.tenantId), otherBefore);
        },
      );

      await t.test(
        "SKU is case-preserving tenant-CI reserved including inactive rows, and different-key races have one winner",
        async () => {
          const base = await unit(db, a);
          const otherBase = await unit(db, b);
          const original = await command.execute(
            { name: "SKU original", baseUnitId: base.id, sku: "Reserved" },
            attempt(a),
          );
          await db.inventoryItem.update({
            where: { id: original.id },
            data: { status: "INACTIVE" },
          });
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute(
              { name: "No replace", baseUnitId: base.id, sku: "reserved" },
              attempt(a),
            ),
            "INVENTORY_ITEM_SKU_TAKEN",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.equal(
            (
              await command.execute(
                { name: "Other workspace", baseUnitId: otherBase.id, sku: "RESERVED" },
                attempt(b),
              )
            ).sku,
            "RESERVED",
          );
          const races = await Promise.allSettled(
            ["Race-SKU", "race-sku"].map((sku) =>
              command.execute({ name: "Race", baseUnitId: base.id, sku }, attempt(a)),
            ),
          );
          assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
          assert.equal(
            races.find((r) => r.status === "rejected").reason.getResponse().code,
            "INVENTORY_ITEM_SKU_TAKEN",
          );
        },
      );

      await t.test(
        "parallel different-key requests cannot both claim the final active-item slot and failed quota attempt rolls back reservation/latch",
        async () => {
          const bases = await Promise.all([unit(db, a), unit(db, a)]);
          const used = await activeCount(db, a);
          maxima.set(a.tenantId, BigInt(used + 1));
          const auditsBefore = await db.auditLog.count({
            where: { tenantId: a.tenantId, action: "inventory.item.create" },
          });
          const contexts = [attempt(a), attempt(a)];
          try {
            const results = await Promise.allSettled(
              bases.map((base, i) =>
                command.execute({ name: `Final slot ${i}`, baseUnitId: base.id }, contexts[i]),
              ),
            );
            assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
            const rejected = results.findIndex((r) => r.status === "rejected");
            assert.equal(results[rejected].reason.getResponse().code, "LIMIT_REACHED");
            assert.deepEqual(results[rejected].reason.getResponse().details, {
              dimensionKey: "inventory.items.active",
              limit: String(used + 1),
              usage: String(used + 1),
            });
            assert.equal(await activeCount(db, a), used + 1);
            assert.equal(
              await db.auditLog.count({
                where: { tenantId: a.tenantId, action: "inventory.item.create" },
              }),
              auditsBefore + 1,
            );
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: bases[rejected].id } }))
                .definitionLocked,
              false,
            );
            assert.equal(
              await db.idempotencyKey.count({
                where: {
                  tenantId: a.tenantId,
                  scope: scopeOf(a),
                  key: contexts[rejected].idempotencyKey,
                },
              }),
              0,
            );
          } finally {
            maxima.delete(a.tenantId);
          }
        },
      );

      await t.test(
        "eight concurrent same-key requests use one slot/audit/result even with a full quota after first commit",
        async () => {
          const base = await unit(db, a);
          const used = await activeCount(db, a);
          const ctx = attempt(a);
          const body = { name: "Same key", baseUnitId: base.id };
          maxima.set(a.tenantId, BigInt(used + 1));
          try {
            const results = await Promise.all(
              Array.from({ length: 8 }, () => command.execute(body, ctx)),
            );
            assert.ok(results.every((row) => row.id === results[0].id));
            assert.equal(await activeCount(db, a), used + 1);
            assert.equal(
              await db.auditLog.count({
                where: { entityId: results[0].id, action: "inventory.item.create" },
              }),
              1,
            );
          } finally {
            maxima.delete(a.tenantId);
          }
        },
      );

      await t.test(
        "zero/over-limit quota checks actual ACTIVE count without a runtime gauge, preserve history and are workspace-scoped",
        async () => {
          const base = await unit(db, a);
          const before = await snapshot(db, a.tenantId);
          const ctx = attempt(a);
          for (const maximum of [0n, BigInt(await activeCount(db, a))]) {
            maxima.set(a.tenantId, maximum);
            await denied(
              command.execute({ name: "Full", baseUnitId: base.id }, ctx),
              "LIMIT_REACHED",
            );
            assert.deepEqual(await snapshot(db, a.tenantId), before);
          }
          const otherBase = await unit(db, b);
          await command.execute({ name: "Other quota", baseUnitId: otherBase.id }, attempt(b));
          maxima.delete(a.tenantId);
          assert.equal(
            (await command.execute({ name: "Full", baseUnitId: base.id }, ctx)).status,
            "ACTIVE",
          );
        },
      );

      await t.test(
        "canonical replay preserves original item snapshot after edits/reassignment/deactivation, inactive original parent and lowered quota",
        async () => {
          const base = await unit(db, a);
          const group = await category(db, a);
          const ctx = attempt(a);
          const body = {
            name: " Replay ",
            baseUnitId: base.id.toUpperCase(),
            categoryId: group.id.toUpperCase(),
            minStock: "1.000000",
          };
          const first = await command.execute(body, {
            ...ctx,
            idempotencyKey: ` ${ctx.idempotencyKey} `,
          });
          const otherBase = await unit(db, a);
          const otherGroup = await category(db, a);
          await assert.rejects(
            db.inventoryItem.update({
              where: { id: first.id },
              data: { baseUnitId: otherBase.id },
            }),
          );
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: otherBase.id } }))
              .definitionLocked,
            false,
          );
          await db.inventoryItem.update({
            where: { id: first.id },
            data: {
              name: "Later",
              status: "INACTIVE",
              sku: "LATER",
              categoryId: otherGroup.id,
              minStock: "2",
            },
          });
          await f.statusCommand.execute(group.id, { status: "INACTIVE" }, attempt(a));
          maxima.set(a.tenantId, 0n);
          try {
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(
              await command.execute(
                {
                  name: "Replay",
                  baseUnitId: base.id,
                  categoryId: group.id,
                  minStock: "1",
                  sku: null,
                },
                ctx,
              ),
              first,
            );
            assert.deepEqual(await snapshot(db, a.tenantId), before);
          } finally {
            maxima.delete(a.tenantId);
          }
        },
      );

      await t.test(
        "fresh permission/all-outlet/device/membership/user/subscription/module/install/capability checks precede replay and policy IO",
        async () => {
          const base = await unit(db, a);
          const ctx = attempt(a);
          const body = { name: "Fresh", baseUnitId: base.id };
          await command.execute(body, ctx);
          const before = await snapshot(db, a.tenantId);
          const beforePolicies = f.policyReads;
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
          assert.equal(f.policyReads, beforePolicies);
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "audit/name/status/minimum/completion faults roll back item/reference latch/audit/key together and allow the failed key to retry",
        async () => {
          for (const stage of ["audit", "name", "status", "minimum", "completion"]) {
            const base = await unit(db, a);
            const ctx = attempt(a);
            const body = { name: `Rollback ${stage}`, baseUnitId: base.id };
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "completion"
                  ? "idempotency_keys"
                  : "inventory_items";
            const action =
              stage === "name"
                ? "NEW.name := 'changed';"
                : stage === "status"
                  ? "NEW.status := 'INACTIVE';"
                  : stage === "minimum"
                    ? "NEW.min_stock := 2;"
                    : stage === "completion"
                      ? "RETURN NULL;"
                      : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_item_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_item_failure BEFORE ${stage === "completion" ? "UPDATE" : "INSERT"} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_item_failure();`);
            try {
              if (stage === "audit") await assert.rejects(command.execute(body, ctx));
              else await denied(command.execute(body, ctx), "IDEMPOTENCY_RESULT_UNAVAILABLE");
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_item_failure ON ${table}; DROP FUNCTION test_item_failure()`,
              );
            }
            assert.equal((await command.execute(body, ctx)).name, body.name);
          }
        },
      );

      await t.test(
        "invalid internal scope/origin/query-like metadata cannot broaden writes and Inventory remains standalone/unregistered",
        async () => {
          const base = await unit(db, a);
          const before = await snapshot(db, a.tenantId);
          const ctx = attempt(a);
          for (const tenantId of [undefined, "", "bad"])
            await assert.rejects(
              f.writer.create(
                { tenantId, actorId: a.userId },
                { name: "Bad", baseUnitId: base.id, sku: null, categoryId: null, minStock: null },
                ctx,
              ),
            );
          await denied(
            command.execute({ name: "Bad", baseUnitId: base.id, cost: "0" }, ctx),
            "VALIDATION_ERROR",
            400,
          );
          await denied(
            command.execute(
              { name: "Bad", baseUnitId: base.id },
              { ...ctx, origin: { ...ctx.origin, actorId: b.userId } },
            ),
            "INVENTORY_COMMAND_CONTEXT_INVALID",
            400,
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.equal(await db.outboxEvent.count(), outboxBefore);
          for (const delegate of [
            db.catalogCategory,
            db.catalogProduct,
            db.order,
            db.kdsTicket,
            db.coreModuleInstallation,
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
