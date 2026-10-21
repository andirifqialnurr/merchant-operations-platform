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
  dto,
  fixture,
  item,
  scopeOf,
  snapshot,
  unit,
} from "./inventory-item-update-fixture.mjs";

const auditCount = (db, a) =>
  db.auditLog.count({ where: { tenantId: a.tenantId, action: "inventory.item.update" } });

test("item definition edit owns only metadata/threshold and commits safe audit/original replay atomically", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const f = await fixture(db);
      const { a, b, command } = f;
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "full edit returns narrow DTO, preserves immutable context and attributes critical audit/status-200 key without free-text values",
        async () => {
          const original = await item(db, a, { sku: "OLD", minStock: "1" });
          const group = await category(db, a);
          const ctx = attempt(a);
          const unitsBefore = await db.inventoryUnit.findMany({
            where: { tenantId: a.tenantId },
            orderBy: { id: "asc" },
          });
          const result = await command.execute(
            original.id,
            {
              name: " Updated ",
              sku: " NEW ",
              categoryId: group.id.toUpperCase(),
              minStock: "0.000001",
            },
            ctx,
          );
          assert.deepEqual(result, {
            id: original.id,
            name: "Updated",
            sku: "NEW",
            categoryId: group.id,
            baseUnitId: original.baseUnitId,
            minStock: "0.000001",
            status: "ACTIVE",
          });
          const row = await db.inventoryItem.findUniqueOrThrow({ where: { id: original.id } });
          assert.deepEqual(row.createdAt, original.createdAt);
          assert.equal(row.tenantId, original.tenantId);
          assert.deepEqual(
            await db.inventoryUnit.findMany({
              where: { tenantId: a.tenantId },
              orderBy: { id: "asc" },
            }),
            unitsBefore,
          );
          const audit = await db.auditLog.findFirstOrThrow({
            where: { entityId: original.id, action: "inventory.item.update" },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, {
            critical: true,
            nameChanged: true,
            skuChanged: true,
            minStockChanged: true,
            before: { categoryId: null },
            after: { categoryId: group.id },
          });
          const key = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(key.status, "COMPLETED");
          assert.equal(key.responseStatus, 200);
          assert.deepEqual(key.responseBody, result);
        },
      );

      await t.test(
        "ACTIVE and INACTIVE partial edits preserve omitted fields/base/status and allow correction with an inactive existing category",
        async () => {
          const group = await category(db, a, { status: "INACTIVE" });
          for (const status of ["ACTIVE", "INACTIVE"]) {
            const original = await item(db, a, {
              categoryId: group.id,
              sku: `RETAIN-${status}`,
              minStock: "2",
              status,
            });
            const result = await command.execute(
              original.id,
              { name: "Correct label", categoryId: group.id },
              attempt(a),
            );
            assert.deepEqual(result, { ...dto(original), name: "Correct label" });
            assert.equal(
              (await command.execute(original.id, { sku: null, minStock: null }, attempt(a)))
                .categoryId,
              group.id,
            );
            assert.equal(
              (await command.execute(original.id, { categoryId: null }, attempt(a))).categoryId,
              null,
            );
          }
        },
      );

      await t.test(
        "nullable clears/explicit zero/smallest/maximal exact threshold remain distinct; whole unit rejects meaningful excess precision",
        async () => {
          const original = await item(db, a);
          for (const minStock of ["0", "0.000001", "999999999999999999999999.999999", null])
            assert.equal(
              (await command.execute(original.id, { minStock }, attempt(a))).minStock,
              minStock,
            );
          const base = await unit(db, a, 0);
          const whole = await item(db, a, { baseUnitId: base.id });
          assert.equal(
            (await command.execute(whole.id, { minStock: "1.000000" }, attempt(a))).minStock,
            "1",
          );
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute(whole.id, { minStock: "0.1" }, attempt(a)),
            "INVENTORY_MINIMUM_PRECISION_EXCEEDED",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "new category assignment requires scoped ACTIVE parent; unchanged inactive is allowed, clear is allowed but relinking inactive is not",
        async () => {
          const inactive = await category(db, a, { status: "INACTIVE" });
          const foreign = await category(db, b);
          const original = await item(db, a, { categoryId: inactive.id });
          const first = await command.execute(
            original.id,
            { categoryId: inactive.id.toUpperCase() },
            attempt(a),
          );
          assert.equal(first.categoryId, inactive.id);
          await command.execute(original.id, { categoryId: null }, attempt(a));
          const before = await snapshot(db, a.tenantId);
          const foreignBefore = await snapshot(db, b.tenantId);
          for (const [categoryId, code, status] of [
            [inactive.id, "INVENTORY_CATEGORY_INACTIVE", 409],
            [foreign.id, "INVENTORY_CATEGORY_NOT_FOUND", 404],
            [randomUUID(), "INVENTORY_CATEGORY_NOT_FOUND", 404],
          ])
            await denied(command.execute(original.id, { categoryId }, attempt(a)), code, status);
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(await snapshot(db, b.tenantId), foreignBefore);
        },
      );

      await t.test(
        "missing/foreign targets share private 404 and leave no reservation or foreign mutation",
        async () => {
          const foreign = await item(db, b);
          const before = await snapshot(db, a.tenantId);
          const other = await snapshot(db, b.tenantId);
          for (const target of [randomUUID(), foreign.id])
            await denied(
              command.execute(target, { name: "No access" }, attempt(a)),
              "INVENTORY_ITEM_NOT_FOUND",
              404,
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(await snapshot(db, b.tenantId), other);
        },
      );

      await t.test(
        "CI SKU includes inactive rows, permits self and NULL, is tenant scoped and has one different-target race winner",
        async () => {
          const reserved = await item(db, a, { sku: "Reserved", status: "INACTIVE" });
          const target = await item(db, a);
          assert.equal(
            (await command.execute(reserved.id, { sku: "Reserved" }, attempt(a))).sku,
            "Reserved",
          );
          assert.equal(
            (await command.execute(reserved.id, { sku: "RESERVED" }, attempt(a))).status,
            "INACTIVE",
          );
          const before = await snapshot(db, a.tenantId);
          await denied(
            command.execute(target.id, { sku: "reserved" }, attempt(a)),
            "INVENTORY_ITEM_SKU_TAKEN",
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          const other = await item(db, b);
          assert.equal(
            (await command.execute(other.id, { sku: "reserved" }, attempt(b))).sku,
            "reserved",
          );
          const rival = await item(db, a);
          const races = await Promise.allSettled([
            command.execute(target.id, { sku: "Race-SKU" }, attempt(a)),
            command.execute(rival.id, { sku: "race-sku" }, attempt(a)),
          ]);
          assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
          assert.equal(
            races.find((r) => r.status === "rejected").reason.getResponse().code,
            "INVENTORY_ITEM_SKU_TAKEN",
          );
          for (const targetId of [target.id, rival.id])
            assert.equal((await command.execute(targetId, { sku: null }, attempt(a))).sku, null);
        },
      );

      await t.test(
        "canonical no-op reserves original result without item/unit/timestamp/audit write and never reverts later state",
        async () => {
          const group = await category(db, a, { status: "INACTIVE" });
          const original = await item(db, a, {
            categoryId: group.id,
            minStock: "1",
            status: "INACTIVE",
          });
          const ctx = attempt(a);
          const patch = {
            name: original.name,
            sku: null,
            categoryId: group.id,
            minStock: "1.000000",
          };
          const before = await snapshot(db, a.tenantId);
          const stamp = (
            await database.query(
              "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_items WHERE id = $1",
              [original.id],
            )
          ).rows[0].stamp;
          const result = await command.execute(original.id, patch, ctx);
          const after = await snapshot(db, a.tenantId);
          assert.deepEqual(after.items, before.items);
          assert.deepEqual(after.units, before.units);
          assert.deepEqual(after.audits, before.audits);
          assert.equal(after.keys.length, before.keys.length + 1);
          assert.equal(
            (
              await database.query(
                "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_items WHERE id = $1",
                [original.id],
              )
            ).rows[0].stamp,
            stamp,
          );
          await command.execute(
            original.id,
            { name: "Later", categoryId: null, minStock: null },
            attempt(a),
          );
          const later = await snapshot(db, a.tenantId);
          assert.deepEqual(await command.execute(original.id, patch, ctx), result);
          assert.deepEqual(await snapshot(db, a.tenantId), later);
        },
      );

      await t.test(
        "eight same-key edits produce one mutation audit and one original status-200 result",
        async () => {
          const original = await item(db, a);
          const ctx = attempt(a);
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              command.execute(original.id, { name: "Same key" }, ctx),
            ),
          );
          assert.ok(results.every((r) => JSON.stringify(r) === JSON.stringify(results[0])));
          assert.equal(
            await db.auditLog.count({
              where: { entityId: original.id, action: "inventory.item.update" },
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
        "metadata edits do not increase active usage and remain allowed at zero/over-limit quota with no policy or counter/event IO",
        async () => {
          const original = await item(db, a);
          const active = await db.inventoryItem.count({
            where: { tenantId: a.tenantId, status: "ACTIVE" },
          });
          const beforePolicies = f.policyReads;
          const before = await snapshot(db, a.tenantId);
          f.maxima.set(a.tenantId, 0n);
          try {
            assert.equal(
              (await command.execute(original.id, { name: "Quota neutral" }, attempt(a))).status,
              "ACTIVE",
            );
            assert.equal(
              await db.inventoryItem.count({ where: { tenantId: a.tenantId, status: "ACTIVE" } }),
              active,
            );
            assert.equal(f.policyReads, beforePolicies);
            const after = await snapshot(db, a.tenantId);
            assert.deepEqual(after.counters, before.counters);
            assert.deepEqual(after.usage, before.usage);
            assert.deepEqual(after.outbox, before.outbox);
          } finally {
            f.maxima.delete(a.tenantId);
          }
        },
      );

      await t.test(
        "fresh write authorization blocks even replay before target/body validation and master IO",
        async () => {
          const original = await item(db, a);
          const ctx = attempt(a);
          const patch = { name: "Fresh" };
          await command.execute(original.id, patch, ctx);
          const before = await snapshot(db, a.tenantId);
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
          await denied(command.execute("bad", {}, ctx), "PERMISSION_DENIED", 403);
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
          f.facts.subscriptionUsable = false;
          await denied(command.execute(original.id, patch, ctx), "SUBSCRIPTION_SUSPENDED", 403);
          f.facts.subscriptionUsable = true;
          f.facts.module.entitled = false;
          await denied(command.execute(original.id, patch, ctx), "ENTITLEMENT_REQUIRED", 403);
          f.facts.module.entitled = true;
          f.facts.capabilities.clear();
          await denied(command.execute(original.id, patch, ctx), "ENTITLEMENT_REQUIRED", 403);
          f.facts.capabilities.add("inventory.item.manage");
          for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
            f.facts.installation = installation;
            await denied(command.execute(original.id, patch, ctx), "INSTALLATION_SETUP_REQUIRED");
          }
          f.facts.installation = "ACTIVE";
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "audit/unsubmitted name/status/minimum/completion faults roll back row/timestamp/audit/key and permit failed-key retry",
        async () => {
          for (const stage of ["audit", "name", "status", "minimum", "completion"]) {
            const original = await item(db, a);
            const ctx = attempt(a);
            const patch = { sku: `FAULT-${stage}` };
            const before = await snapshot(db, a.tenantId);
            const table =
              stage === "audit"
                ? "audit_logs"
                : stage === "completion"
                  ? "idempotency_keys"
                  : "inventory_items";
            const action =
              stage === "name"
                ? "NEW.name := 'unexpected';"
                : stage === "status"
                  ? "NEW.status := 'INACTIVE';"
                  : stage === "minimum"
                    ? "NEW.min_stock := 2;"
                    : stage === "completion"
                      ? "RETURN NULL;"
                      : "RAISE EXCEPTION 'fixture failure';";
            await database.query(`CREATE FUNCTION test_item_update_failure() RETURNS trigger AS $$ BEGIN ${action} RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_item_update_failure BEFORE ${stage === "audit" ? "INSERT" : "UPDATE"} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_item_update_failure();`);
            try {
              if (stage === "audit") await assert.rejects(command.execute(original.id, patch, ctx));
              else
                await denied(
                  command.execute(original.id, patch, ctx),
                  "IDEMPOTENCY_RESULT_UNAVAILABLE",
                );
              assert.deepEqual(await snapshot(db, a.tenantId), before);
            } finally {
              await database.query(
                `DROP TRIGGER test_item_update_failure ON ${table}; DROP FUNCTION test_item_update_failure()`,
              );
            }
            assert.equal((await command.execute(original.id, patch, ctx)).sku, patch.sku);
          }
        },
      );

      await t.test(
        "invalid internal scope/target/origin and readonly body cannot broaden writes; no Catalog/POS/KDS/install/outbox changes",
        async () => {
          const original = await item(db, a);
          const before = await snapshot(db, a.tenantId);
          const ctx = attempt(a);
          for (const tenantId of [undefined, "", "bad"])
            await assert.rejects(
              f.updater.update({ tenantId, actorId: a.userId }, original.id, { name: "Bad" }, ctx),
            );
          await assert.rejects(
            f.updater.update(
              { tenantId: a.tenantId, actorId: a.userId },
              "bad",
              { name: "Bad" },
              ctx,
            ),
          );
          for (const patch of [
            { baseUnitId: original.baseUnitId },
            { status: "ACTIVE" },
            { cost: "0" },
          ])
            await denied(command.execute(original.id, patch, ctx), "VALIDATION_ERROR", 400);
          await denied(
            command.execute(
              original.id,
              { name: "Bad" },
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
          assert.ok((await auditCount(db, a)) > 0);
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
