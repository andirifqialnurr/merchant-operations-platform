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
  waitForBlocked,
} from "./inventory-item-update-fixture.mjs";

const outcome = (promise) =>
  promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
async function queued(database, readerPid, blockers) {
  const deadline = Date.now() + 5000;
  do {
    const actual = (
      await database.query("SELECT pg_blocking_pids($1::int) AS blockers", [readerPid])
    ).rows[0].blockers;
    if (actual.some((pid) => blockers.includes(pid))) return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected specific reader to wait on update/queued writer");
}

test("item update replay and row/parent/quota locks preserve original results without lost metadata or history", async (t) => {
  let legacyTenantId;
  let legacyItemId;
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const f = await fixture(db);
        const { a, b, command } = f;

        await t.test(
          "normalized original update/create snapshots survive later names/SKU/status/category/minimum and original parent deactivation",
          async () => {
            const base = await unit(db, a);
            const oldGroup = await category(db, a);
            const next = await category(db, a);
            const createCtx = attempt(a);
            const createBody = {
              name: "Initial item",
              baseUnitId: base.id,
              categoryId: oldGroup.id,
              minStock: "1",
            };
            const created = await f.itemCreator.execute(createBody, createCtx);
            const ctx = attempt(a);
            const patch = {
              name: " Updated ",
              categoryId: next.id.toUpperCase(),
              minStock: "2.000000",
            };
            const first = await command.execute(created.id.toUpperCase(), patch, {
              ...ctx,
              idempotencyKey: ` ${ctx.idempotencyKey} `,
            });
            await command.execute(
              created.id,
              { name: "Latest", sku: "LATEST", categoryId: null, minStock: null },
              attempt(a),
            );
            await db.inventoryItem.update({
              where: { id: created.id },
              data: { status: "INACTIVE" },
            });
            await f.statusCommand.execute(next.id, { status: "INACTIVE" }, attempt(a));
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(
              await command.execute(
                created.id,
                { minStock: "2", categoryId: next.id, name: "Updated" },
                ctx,
              ),
              first,
            );
            assert.equal(first.status, "ACTIVE");
            assert.equal(first.sku, null);
            assert.deepEqual(await f.itemCreator.execute(createBody, createCtx), created);
            assert.deepEqual(await snapshot(db, a.tenantId), before);
            assert.equal(
              (await db.inventoryItem.findUniqueOrThrow({ where: { id: created.id } })).name,
              "Latest",
            );
          },
        );

        await t.test(
          "target/patch/NULL omission hashes and actor/workspace/create-vs-update scopes remain separate",
          async () => {
            const original = await item(db, a);
            const other = await item(db, a);
            const foreign = await item(db, b);
            const key = `shared:${randomUUID()}`;
            const ctx = attempt(a, key);
            const patch = { name: "Scoped" };
            const first = await command.execute(original.id, patch, ctx);
            for (const [target, changed] of [
              [other.id, patch],
              [original.id, { name: "Different" }],
              [original.id, { ...patch, sku: null }],
              [original.id, { ...patch, categoryId: null }],
              [original.id, { ...patch, minStock: null }],
            ])
              await denied(command.execute(target, changed, ctx), "IDEMPOTENCY_KEY_REUSED");
            assert.equal(
              (await command.execute(foreign.id, patch, attempt(b, key))).id,
              foreign.id,
            );
            assert.notEqual(
              (
                await f.itemCreator.execute(
                  { name: "Create operation", baseUnitId: original.baseUnitId },
                  attempt(a, key),
                )
              ).id,
              first.id,
            );
            const user = await db.user.create({
              data: {
                displayName: "Other owner",
                email: "item-update-owner@example.test",
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
            const identity = { tenantId: a.tenantId, userId: user.id, membershipId: membership.id };
            await command.execute(
              original.id,
              { name: "Other actor label" },
              attempt(identity, key),
            );
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(await command.execute(original.id, patch, ctx), first);
            assert.deepEqual(await snapshot(db, a.tenantId), before);
          },
        );

        await t.test(
          "pending/failed/expired/incomplete/corrupt patched/immutable/scoped snapshots fail closed and remain reserved",
          async () => {
            const original = await item(db, a);
            const otherBase = await unit(db, a);
            const foreign = await item(db, b);
            const foreignGroup = await category(db, b);
            const ctx = attempt(a);
            const patch = { name: "Reserved" };
            const first = await command.execute(original.id, patch, ctx);
            const record = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            });
            await command.execute(original.id, { name: "Later label" }, attempt(a));
            const itemsBefore = await db.inventoryItem.findMany({ orderBy: { id: "asc" } });
            const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
            for (const [data, code] of [
              [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
              [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
              [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
              [{ responseStatus: 201 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...first, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...first, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...first, name: "Different" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { ...first, status: "ARCHIVED" } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...first, baseUnitId: otherBase.id } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...first, categoryId: foreignGroup.id } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ responseBody: { ...first, minStock: 0 } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...first, cost: "0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { id: original.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
            ]) {
              const corrupted = await db.idempotencyKey.update({ where: { id: record.id }, data });
              await denied(command.execute(original.id, patch, ctx), code);
              assert.deepEqual(
                await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
                corrupted,
              );
              await db.idempotencyKey.update({
                where: { id: record.id },
                data: {
                  status: "COMPLETED",
                  expiresAt: record.expiresAt,
                  responseStatus: 200,
                  responseBody: first,
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
          "concurrent different-key partial edits preserve each other's omitted fields and separate original results",
          async () => {
            const original = await item(db, a, { minStock: "1", status: "INACTIVE" });
            const group = await category(db, a);
            const firstCtx = attempt(a);
            const secondCtx = attempt(a);
            const [first, second] = await Promise.all([
              command.execute(original.id, { name: "Parallel", sku: "PARALLEL" }, firstCtx),
              command.execute(
                original.id,
                { categoryId: group.id, minStock: "0.000001" },
                secondCtx,
              ),
            ]);
            const final = await db.inventoryItem.findUniqueOrThrow({ where: { id: original.id } });
            assert.deepEqual(dto(final), {
              ...dto(original),
              name: "Parallel",
              sku: "PARALLEL",
              categoryId: group.id,
              minStock: "0.000001",
            });
            assert.equal(
              await db.auditLog.count({
                where: { entityId: original.id, action: "inventory.item.update" },
              }),
              2,
            );
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(
              await command.execute(original.id, { name: "Parallel", sku: "PARALLEL" }, firstCtx),
              first,
            );
            assert.deepEqual(
              await command.execute(
                original.id,
                { categoryId: group.id, minStock: "0.000001" },
                secondCtx,
              ),
              second,
            );
            assert.deepEqual(await snapshot(db, a.tenantId), before);
          },
        );

        await t.test(
          "waiting update reads committed item/status/category before deciding same inactive category no-op vs forbidden reassignment",
          async () => {
            for (const same of [true, false]) {
              const target = await category(db, a, { status: "INACTIVE" });
              const different = await category(db, a);
              const original = await item(db, a);
              const client = createClient();
              await client.connect();
              let pending;
              try {
                await client.query("BEGIN");
                await client.query(
                  "UPDATE inventory_items SET name = 'External label', status = 'INACTIVE', category_id = $1, updated_at = now() WHERE id = $2",
                  [same ? target.id : different.id, original.id],
                );
                const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                const stamp = (
                  await client.query(
                    "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_items WHERE id = $1",
                    [original.id],
                  )
                ).rows[0].stamp;
                pending = outcome(
                  command.execute(original.id, { categoryId: target.id }, attempt(a)),
                );
                await waitForBlocked(database, pid);
                await client.query("COMMIT");
                const result = await pending;
                if (same)
                  assert.deepEqual(result.value, {
                    ...dto(original),
                    name: "External label",
                    status: "INACTIVE",
                    categoryId: target.id,
                  });
                else assert.equal(result.error?.getResponse().code, "INVENTORY_CATEGORY_INACTIVE");
                assert.equal(
                  (
                    await database.query(
                      "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_items WHERE id = $1",
                      [original.id],
                    )
                  ).rows[0].stamp,
                  stamp,
                );
                assert.equal(
                  await db.auditLog.count({
                    where: { entityId: original.id, action: "inventory.item.update" },
                  }),
                  0,
                );
              } finally {
                await client.query("ROLLBACK");
                await pending;
                await client.end();
              }
            }
          },
        );

        await t.test(
          "new category assignment sees lifecycle winner's newly committed status under parent lock",
          async () => {
            for (const status of ["ACTIVE", "INACTIVE"]) {
              const group = await category(db, a, {
                status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              });
              const original = await item(db, a);
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
                pending = outcome(
                  command.execute(original.id, { categoryId: group.id }, attempt(a)),
                );
                await waitForBlocked(database, pid);
                await client.query("COMMIT");
                const result = await pending;
                if (status === "ACTIVE") assert.equal(result.value?.categoryId, group.id);
                else {
                  assert.equal(result.error?.getResponse().code, "INVENTORY_CATEGORY_INACTIVE");
                  assert.equal(
                    (await db.inventoryItem.findUniqueOrThrow({ where: { id: original.id } }))
                      .categoryId,
                    null,
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
          "critical audit holds item/parent/quota locks through commit while authorized lifecycle/edit and specific reader queue",
          async () => {
            const original = await item(db, a);
            const group = await category(db, a);
            const ctx = attempt(a);
            const barrier = createClient();
            const reader = createClient();
            await barrier.connect();
            await reader.connect();
            const readerPid = (await reader.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            let pending;
            let lifecycle;
            let competitor;
            let reading;
            try {
              await barrier.query("SELECT pg_advisory_lock(846302)");
              const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              await database.query(`CREATE FUNCTION test_item_edit_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.item.update' THEN PERFORM pg_advisory_xact_lock(846302); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_item_edit_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_item_edit_barrier();`);
              pending = outcome(
                command.execute(
                  original.id,
                  { categoryId: group.id, sku: "LOCKED", minStock: "0.000001" },
                  ctx,
                ),
              );
              const writerPid = await waitForBlocked(database, pid);
              lifecycle = outcome(
                f.statusCommand.execute(group.id, { status: "INACTIVE" }, attempt(a)),
              );
              await waitForBlocked(database, writerPid);
              competitor = outcome(
                command.execute(original.id, { name: "After commit" }, attempt(a)),
              );
              reading = outcome(
                reader.query(
                  "SELECT sku, status FROM inventory_items WHERE id = $1 FOR NO KEY UPDATE",
                  [original.id],
                ),
              );
              await queued(database, readerPid, [writerPid]);
              await barrier.query("SELECT pg_advisory_unlock(846302)");
              assert.equal((await pending).value?.sku, "LOCKED");
              assert.equal((await lifecycle).value?.status, "INACTIVE");
              assert.equal((await competitor).value?.name, "After commit");
              assert.deepEqual((await reading).value?.rows[0], { sku: "LOCKED", status: "ACTIVE" });
              const final = await db.inventoryItem.findUniqueOrThrow({
                where: { id: original.id },
              });
              assert.equal(final.name, "After commit");
              assert.equal(final.categoryId, group.id);
              assert.equal(final.sku, "LOCKED");
              assert.equal(final.minStock.toFixed(), "0.000001");
            } finally {
              await barrier.query("SELECT pg_advisory_unlock_all()");
              await pending;
              await lifecycle;
              await competitor;
              await reading;
              await database.query(
                "DROP TRIGGER IF EXISTS test_item_edit_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_item_edit_barrier()",
              );
              await reader.end();
              await barrier.end();
            }
          },
        );

        await t.test(
          "legacy unknown-dimension item with noncanonical minimum can no-op canonically and edit labels without redefining unit/history",
          async () => {
            const access = new AccessService(new PrismaAccessRepository());
            await access.provisionTenantOwner(legacyTenantId, a.userId);
            const membership = await db.tenantMembership.findUniqueOrThrow({
              where: { tenantId_userId: { tenantId: legacyTenantId, userId: a.userId } },
            });
            const identity = {
              tenantId: legacyTenantId,
              userId: a.userId,
              membershipId: membership.id,
            };
            const before = await snapshot(db, legacyTenantId);
            const result = await command.execute(
              legacyItemId,
              { minStock: "1.000000" },
              attempt(identity),
            );
            assert.equal(result.minStock, "1");
            assert.deepEqual((await snapshot(db, legacyTenantId)).items, before.items);
            const updated = await command.execute(
              legacyItemId,
              { name: "Legacy corrected" },
              attempt(identity),
            );
            assert.equal(updated.baseUnitId, result.baseUnitId);
            const unitRow = await db.inventoryUnit.findUniqueOrThrow({
              where: { id: result.baseUnitId },
            });
            assert.equal(unitRow.dimension, null);
            assert.equal(unitRow.precision, 0);
            assert.equal(unitRow.definitionLocked, true);
            assert.deepEqual((await snapshot(db, legacyTenantId)).units, before.units);
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
            "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy item edit','item-update-legacy',now()) RETURNING id",
          )
        ).rows[0].id;
        const base = (
          await database.query(
            "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,'OLD','Legacy',0) RETURNING id",
            [legacyTenantId],
          )
        ).rows[0].id;
        legacyItemId = (
          await database.query(
            "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Historical item',$2,1.000000) RETURNING id",
            [legacyTenantId, base],
          )
        ).rows[0].id;
      },
    },
  );
});
