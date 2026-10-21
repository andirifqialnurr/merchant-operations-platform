import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { UpdateInventoryUnit } from "../src/modules/inventory/application/update-inventory-unit.ts";
import { PrismaInventoryUnitUpdater } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-updater.ts";
import {
  attempt,
  category,
  denied,
  fixture,
  scopeOf,
  unit,
  waitForBlocked,
} from "./inventory-item-create-fixture.mjs";

async function queued(database, pid, blockers) {
  const deadline = Date.now() + 5000;
  do {
    const actual = (await database.query("SELECT pg_blocking_pids($1::int) AS blockers", [pid]))
      .rows[0].blockers;
    if (actual.some((id) => blockers.includes(id))) return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Specific reader did not wait on writer/queued updater");
}
const outcome = (promise) =>
  promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );

// Historical unknown unit is seeded before dimension migration, never by disabling guards.
test("item replay and locked parent/quota checks preserve history and serialize contested writes", async (t) => {
  let legacyTenantId;
  let legacyUnitId;
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const f = await fixture(db);
        const { a, b, command, maxima } = f;
        const updater = new UpdateInventoryUnit(f.authorizer, new PrismaInventoryUnitUpdater());

        await t.test(
          "logical input hash distinguishes SKU/parent/minimum and key remains actor/workspace/operation scoped",
          async () => {
            const base = await unit(db, a);
            const group = await category(db, a);
            const otherBase = await unit(db, b);
            const key = `shared:${randomUUID()}`;
            const body = { name: "Shared", baseUnitId: base.id };
            const ctx = attempt(a, key);
            const original = await command.execute(body, ctx);
            for (const patch of [
              { name: "Different" },
              { sku: "NEW" },
              { minStock: "0" },
              { categoryId: group.id },
              { baseUnitId: (await unit(db, a)).id },
            ])
              await denied(command.execute({ ...body, ...patch }, ctx), "IDEMPOTENCY_KEY_REUSED");
            assert.notEqual(
              (await command.execute({ ...body, baseUnitId: otherBase.id }, attempt(b, key))).id,
              original.id,
            );
            assert.ok((await f.creator.execute({ name: "Other operation" }, attempt(a, key))).id);
            const user = await db.user.create({
              data: {
                displayName: "Other owner",
                email: "item-second-owner@example.test",
                passwordHash: "fixture-only",
              },
            });
            await new AccessService(new PrismaAccessRepository()).provisionTenantOwner(
              a.tenantId,
              user.id,
            );
            const membership = await db.tenantMembership.findUniqueOrThrow({
              where: { tenantId_userId: { tenantId: a.tenantId, userId: user.id } },
            });
            const other = { tenantId: a.tenantId, userId: user.id, membershipId: membership.id };
            assert.notEqual((await command.execute(body, attempt(other, key))).id, original.id);
          },
        );

        await t.test(
          "PENDING/FAILED/expired/incomplete/corrupt DTO/input/identity results fail closed without replaying creation or releasing key",
          async () => {
            const base = await unit(db, a);
            const body = { name: "Reserved", baseUnitId: base.id };
            const ctx = attempt(a);
            const result = await command.execute(body, ctx);
            const record = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            });
            const foreignBase = await unit(db, b);
            const foreign = await command.execute(
              { name: "Foreign", baseUnitId: foreignBase.id },
              attempt(b),
            );
            const itemsBefore = await db.inventoryItem.findMany({ orderBy: { id: "asc" } });
            const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
            for (const [data, code] of [
              [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
              [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
              [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
              [{ responseStatus: 200 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { ...result, name: "Different" } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...result, status: "INACTIVE" } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ responseBody: { ...result, minStock: "0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { ...result, baseUnitId: foreignBase.id } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ responseBody: { ...result, cost: "0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { id: result.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
            ]) {
              const corrupted = await db.idempotencyKey.update({ where: { id: record.id }, data });
              await denied(command.execute(body, ctx), code);
              assert.deepEqual(
                await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
                corrupted,
              );
              await db.idempotencyKey.update({
                where: { id: record.id },
                data: {
                  status: "COMPLETED",
                  expiresAt: record.expiresAt,
                  responseStatus: 201,
                  responseBody: result,
                  requestHash: record.requestHash,
                  updatedAt: record.updatedAt,
                },
              });
            }
            assert.deepEqual(
              await db.inventoryItem.findMany({ orderBy: { id: "asc" } }),
              itemsBefore,
            );
            assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
          },
        );

        await t.test(
          "legacy unknown-dimension unit can define a same-unit item without inferring compatibility or changing dimension",
          async () => {
            const access = new AccessService(new PrismaAccessRepository());
            await access.provisionTenantOwner(legacyTenantId, a.userId);
            const member = await db.tenantMembership.findUniqueOrThrow({
              where: { tenantId_userId: { tenantId: legacyTenantId, userId: a.userId } },
            });
            const identity = {
              tenantId: legacyTenantId,
              userId: a.userId,
              membershipId: member.id,
            };
            const result = await command.execute(
              { name: "Legacy unit item", baseUnitId: legacyUnitId, minStock: "0" },
              attempt(identity),
            );
            assert.equal(result.baseUnitId, legacyUnitId);
            assert.equal(result.minStock, "0");
            const parent = await db.inventoryUnit.findUniqueOrThrow({
              where: { id: legacyUnitId },
            });
            assert.equal(parent.dimension, null);
            assert.equal(parent.definitionLocked, true);
          },
        );

        await t.test(
          "category lifecycle winning lock is evaluated from newly committed ACTIVE/INACTIVE state, without a stale preflight",
          async () => {
            for (const status of ["ACTIVE", "INACTIVE"]) {
              const base = await unit(db, a);
              const group = await category(db, a, {
                status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              });
              const client = createClient();
              await client.connect();
              let pending;
              try {
                await client.query("BEGIN");
                await client.query("UPDATE inventory_categories SET status = $1 WHERE id = $2", [
                  status,
                  group.id,
                ]);
                const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                const ctx = attempt(a);
                pending = outcome(
                  command.execute(
                    { name: "Wait category", baseUnitId: base.id, categoryId: group.id },
                    ctx,
                  ),
                );
                await waitForBlocked(database, pid);
                await client.query("COMMIT");
                const result = await pending;
                if (status === "ACTIVE") assert.equal(result.value?.categoryId, group.id);
                else {
                  assert.equal(result.error?.getResponse().code, "INVENTORY_CATEGORY_INACTIVE");
                  assert.equal(
                    (await db.inventoryUnit.findUniqueOrThrow({ where: { id: base.id } }))
                      .definitionLocked,
                    false,
                  );
                  assert.equal(
                    await db.idempotencyKey.count({
                      where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
                    }),
                    0,
                  );
                }
              } finally {
                await client.query("ROLLBACK");
                await pending;
                await client.end();
              }
            }
          },
        );

        await t.test(
          "unit precision winning lock is used for minimum validation and rejected reference never latches",
          async () => {
            const base = await unit(db, a);
            const client = createClient();
            await client.connect();
            let pending;
            try {
              await client.query("BEGIN");
              await client.query("UPDATE inventory_units SET precision = 0 WHERE id = $1", [
                base.id,
              ]);
              const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              pending = outcome(
                command.execute(
                  { name: "Wait precision", baseUnitId: base.id, minStock: "0.1" },
                  attempt(a),
                ),
              );
              await waitForBlocked(database, pid);
              await client.query("COMMIT");
              assert.equal(
                (await pending).error?.getResponse().code,
                "INVENTORY_MINIMUM_PRECISION_EXCEEDED",
              );
              assert.equal(
                (await db.inventoryUnit.findUniqueOrThrow({ where: { id: base.id } }))
                  .definitionLocked,
                false,
              );
            } finally {
              await client.query("ROLLBACK");
              await pending;
              await client.end();
            }
          },
        );

        await t.test(
          "critical item audit keeps parent locks until commit; authorized unit edit/category deactivation and specific reader see committed reference",
          async () => {
            const base = await unit(db, a);
            const group = await category(db, a);
            const barrier = createClient();
            const reader = createClient();
            await barrier.connect();
            await reader.connect();
            const readerPid = (await reader.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            let pending;
            let editing;
            let deactivating;
            let reading;
            try {
              await barrier.query("SELECT pg_advisory_lock(846299)");
              const barrierPid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
                .pid;
              await database.query(`CREATE FUNCTION test_item_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.item.create' THEN PERFORM pg_advisory_xact_lock(846299); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_item_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_item_barrier();`);
              pending = outcome(
                command.execute(
                  {
                    name: "Locks held",
                    baseUnitId: base.id,
                    categoryId: group.id,
                    minStock: "0.1",
                  },
                  attempt(a),
                ),
              );
              const writerPid = await waitForBlocked(database, barrierPid);
              editing = outcome(updater.execute(base.id, { precision: 0 }, attempt(a)));
              const editorPid = await waitForBlocked(database, writerPid);
              deactivating = outcome(
                f.statusCommand.execute(group.id, { status: "INACTIVE" }, attempt(a)),
              );
              reading = outcome(
                reader.query(
                  "SELECT precision, definition_locked FROM inventory_units WHERE id = $1 FOR NO KEY UPDATE",
                  [base.id],
                ),
              );
              await queued(database, readerPid, [writerPid, editorPid]);
              await barrier.query("SELECT pg_advisory_unlock(846299)");
              assert.equal((await pending).value?.status, "ACTIVE");
              assert.equal(
                (await editing).error?.getResponse().code,
                "INVENTORY_UNIT_DEFINITION_LOCKED",
              );
              assert.equal((await deactivating).value?.status, "INACTIVE");
              assert.deepEqual((await reading).value?.rows[0], {
                precision: 6,
                definition_locked: true,
              });
              assert.equal(
                await db.inventoryItem.count({
                  where: { tenantId: a.tenantId, categoryId: group.id, status: "ACTIVE" },
                }),
                1,
              );
            } finally {
              await barrier.query("SELECT pg_advisory_unlock_all()");
              await pending;
              await editing;
              await deactivating;
              await reading;
              await database.query(
                "DROP TRIGGER IF EXISTS test_item_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_item_barrier()",
              );
              await reader.end();
              await barrier.end();
            }
          },
        );

        await t.test(
          "different-unit final-slot competitor waits on workspace quota lock through audit then sees committed count",
          async () => {
            const first = await unit(db, a);
            const second = await unit(db, a);
            const used = await db.inventoryItem.count({
              where: { tenantId: a.tenantId, status: "ACTIVE" },
            });
            maxima.set(a.tenantId, BigInt(used + 1));
            const barrier = createClient();
            await barrier.connect();
            let pending;
            let competitor;
            try {
              await barrier.query("SELECT pg_advisory_lock(846300)");
              const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              await database.query(`CREATE FUNCTION test_item_quota_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.item.create' THEN PERFORM pg_advisory_xact_lock(846300); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_item_quota_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_item_quota_barrier();`);
              pending = outcome(
                command.execute({ name: "First final slot", baseUnitId: first.id }, attempt(a)),
              );
              const writerPid = await waitForBlocked(database, pid);
              competitor = outcome(
                command.execute({ name: "Different unit", baseUnitId: second.id }, attempt(a)),
              );
              await waitForBlocked(database, writerPid);
              await barrier.query("SELECT pg_advisory_unlock(846300)");
              assert.equal((await pending).value?.status, "ACTIVE");
              assert.equal((await competitor).error?.getResponse().code, "LIMIT_REACHED");
              assert.equal(
                (await db.inventoryUnit.findUniqueOrThrow({ where: { id: second.id } }))
                  .definitionLocked,
                false,
              );
              assert.equal(
                await db.inventoryItem.count({ where: { tenantId: a.tenantId, status: "ACTIVE" } }),
                used + 1,
              );
            } finally {
              await barrier.query("SELECT pg_advisory_unlock_all()");
              await pending;
              await competitor;
              maxima.delete(a.tenantId);
              await database.query(
                "DROP TRIGGER IF EXISTS test_item_quota_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_item_quota_barrier()",
              );
              await barrier.end();
            }
          },
        );
      } finally {
        await db.$disconnect();
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
      }
    },
    {
      beforeMigration: async ({ directory, database }) => {
        if (directory !== "20261021020000_inventory_unit_dimension") return;
        legacyTenantId = (
          await database.query(
            "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy item writer','item-create-legacy',now()) RETURNING id",
          )
        ).rows[0].id;
        legacyUnitId = (
          await database.query(
            "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,'OLD','Legacy',0) RETURNING id",
            [legacyTenantId],
          )
        ).rows[0].id;
      },
    },
  );
});
