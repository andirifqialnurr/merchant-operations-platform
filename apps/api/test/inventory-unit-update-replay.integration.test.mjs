import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import {
  attempt,
  denied,
  fixture,
  scopeOf,
  snapshot,
  unit,
  waitForBlocked,
} from "./inventory-unit-update-fixture.mjs";

const legacy = [];
let legacyTenantId;

test("unit update replay and row locks never reinterpret referenced or historical definitions", async (t) => {
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const { a, b, updater, command, creator } = await fixture(db);

        await t.test(
          "normalized update replays original result after later change/reference without modifying create snapshot",
          async () => {
            const createCtx = attempt(a);
            const body = { code: "kg", name: "Kilogram", precision: 3, dimension: "MASS" };
            const created = await creator.execute(body, createCtx);
            const key = `normalized:${randomUUID()}`;
            const first = await command.execute(
              created.id.toUpperCase(),
              { name: " Gram ", code: " g ", precision: 6 },
              attempt(a, ` ${key} `),
            );
            const saved = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key },
            });
            await command.execute(
              created.id,
              { name: "Latest", code: "grams", precision: 0 },
              attempt(a),
            );
            await db.inventoryItem.create({
              data: { tenantId: a.tenantId, name: "Referenced now", baseUnitId: created.id },
            });
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(
              await command.execute(
                created.id,
                { precision: 6, code: "g", name: "Gram" },
                attempt(a, key),
              ),
              first,
            );
            assert.deepEqual(await creator.execute(body, createCtx), created);
            assert.deepEqual(await snapshot(db, a.tenantId), before);
            assert.deepEqual(
              await db.idempotencyKey.findUniqueOrThrow({ where: { id: saved.id } }),
              saved,
            );
          },
        );

        await t.test(
          "logical key includes target/body and stays separate across tenant/actor/create operation",
          async () => {
            const original = await unit(db, a);
            const second = await unit(db, a);
            const foreign = await unit(db, b);
            const key = `shared:${randomUUID()}`;
            await creator.execute(
              { code: "operation", name: "Operation", precision: 0, dimension: "COUNT" },
              attempt(a, key),
            );
            const first = await command.execute(original.id, { name: "First" }, attempt(a, key));
            await denied(
              command.execute(second.id, { name: "First" }, attempt(a, key)),
              "IDEMPOTENCY_KEY_REUSED",
            );
            await denied(
              command.execute(original.id, { name: "Other" }, attempt(a, key)),
              "IDEMPOTENCY_KEY_REUSED",
            );
            assert.notEqual(
              (await command.execute(foreign.id, { name: "Foreign" }, attempt(b, key))).id,
              first.id,
            );
            const user = await db.user.create({
              data: {
                displayName: "Other",
                email: "unit-update-other@example.test",
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
            const changed = await command.execute(
              original.id,
              { name: "Other actor" },
              attempt(other, key),
            );
            assert.equal(changed.name, "Other actor");
            assert.deepEqual(
              await command.execute(original.id, { name: "First" }, attempt(a, key)),
              first,
            );
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } })).name,
              "Other actor",
            );
          },
        );

        await t.test(
          "uncertain/expired/corrupt/mismatched saved results fail closed without reapplying a patch",
          async () => {
            const original = await unit(db, a);
            const foreign = await unit(db, b);
            const ctx = attempt(a);
            const patch = { name: "First" };
            const result = await command.execute(original.id, patch, ctx);
            const record = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            });
            await command.execute(original.id, { name: "Now" }, attempt(a));
            const rowsBefore = await db.inventoryUnit.findMany({ orderBy: { id: "asc" } });
            const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
            for (const [data, expected] of [
              [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
              [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
              [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
              [{ responseStatus: 201 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, name: "Wrong" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, dimension: null } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { ...result, dimension: "VOLUME" } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...result, definitionLocked: true } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { id: result.id, name: result.name } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
            ]) {
              await db.idempotencyKey.update({ where: { id: record.id }, data });
              await denied(command.execute(original.id, patch, ctx), expected);
              await db.idempotencyKey.update({
                where: { id: record.id },
                data: {
                  status: "COMPLETED",
                  expiresAt: record.expiresAt,
                  responseStatus: 200,
                  responseBody: result,
                  requestHash: record.requestHash,
                },
              });
            }
            assert.deepEqual(
              await db.inventoryUnit.findMany({ orderBy: { id: "asc" } }),
              rowsBefore,
            );
            assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
          },
        );

        await t.test(
          "different-key concurrent partial updates preserve fields omitted by the other writer",
          async () => {
            const original = await unit(db, a);
            const code = `c${randomUUID().slice(0, 12)}`;
            await Promise.all([
              command.execute(original.id, { code, precision: 0 }, attempt(a)),
              command.execute(original.id, { name: "Concurrent label" }, attempt(a)),
            ]);
            const final = await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } });
            assert.equal(final.code, code);
            assert.equal(final.precision, 0);
            assert.equal(final.name, "Concurrent label");
            assert.equal(final.dimension, "MASS");
            assert.equal(
              await db.auditLog.count({
                where: {
                  tenantId: a.tenantId,
                  entityId: original.id,
                  action: "inventory.unit.update",
                },
              }),
              2,
            );
          },
        );

        await t.test(
          "first item/conversion reference wins the row lock before update, so mutation is denied",
          async () => {
            for (const reference of ["item", "conversion"]) {
              const original = await unit(db, a);
              const target = await unit(db, a);
              const client = createClient();
              await client.connect();
              let pending;
              try {
                await client.query("BEGIN");
                if (reference === "item")
                  await client.query(
                    "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Use',$2,0.000001)",
                    [a.tenantId, original.id],
                  );
                else
                  await client.query(
                    "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
                    [a.tenantId, original.id, target.id],
                  );
                const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                const ctx = attempt(a);
                pending = command.execute(original.id, { precision: 0 }, ctx).then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
                await waitForBlocked(database, pid);
                await client.query("COMMIT");
                assert.equal(
                  (await pending).error?.getResponse().code,
                  "INVENTORY_UNIT_DEFINITION_LOCKED",
                );
                assert.equal(
                  await db.idempotencyKey.count({
                    where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
                  }),
                  0,
                );
                assert.equal(
                  (await db.inventoryUnit.findUniqueOrThrow({ where: { id: original.id } }))
                    .precision,
                  6,
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
          "update holds the definition through audit/commit; following reference validates the committed precision",
          async () => {
            for (const minStock of ["0.000001", "1"]) {
              const original = await unit(db, a);
              const barrier = createClient();
              const reference = createClient();
              await barrier.connect();
              await reference.connect();
              let pending;
              let inserting;
              try {
                await barrier.query("SELECT pg_advisory_lock(846294)");
                const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                await database.query(`CREATE FUNCTION test_unit_update_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.unit.update' THEN PERFORM pg_advisory_xact_lock(846294); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
              CREATE TRIGGER test_unit_update_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_unit_update_barrier();`);
                pending = command.execute(original.id, { precision: 0 }, attempt(a)).then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
                const writerPid = await waitForBlocked(database, pid);
                inserting = reference
                  .query(
                    "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'After update',$2,$3)",
                    [a.tenantId, original.id, minStock],
                  )
                  .then(
                    (value) => ({ value }),
                    (error) => ({ error }),
                  );
                await waitForBlocked(database, writerPid);
                await barrier.query("SELECT pg_advisory_unlock(846294)");
                assert.equal((await pending).value?.precision, 0);
                if (minStock === "1") assert.ok((await inserting).value);
                else
                  assert.equal(
                    (await inserting).error?.constraint,
                    "inventory_items_min_stock_unit_precision_check",
                  );
                const final = await db.inventoryUnit.findUniqueOrThrow({
                  where: { id: original.id },
                });
                assert.equal(final.precision, 0);
                assert.equal(final.definitionLocked, minStock === "1");
              } finally {
                await barrier.query("SELECT pg_advisory_unlock_all()");
                await pending;
                await inserting;
                await database.query(
                  "DROP TRIGGER IF EXISTS test_unit_update_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_unit_update_barrier()",
                );
                await barrier.end();
                await reference.end();
              }
            }
          },
        );

        await t.test(
          "legacy unknown dimensions remain null through unused definition edits and referenced label corrections",
          async () => {
            const actorId = randomUUID();
            const scope = { tenantId: legacyTenantId, actorId };
            const ctx = () => ({
              idempotencyKey: `legacy-update:${randomUUID()}`,
              origin: { actorId, channel: "API" },
            });
            const unused = await updater.update(
              scope,
              legacy[0],
              { code: "legacy-corrected", name: "Corrected", precision: 0 },
              ctx(),
            );
            assert.equal(unused.dimension, null);
            const used = await updater.update(
              scope,
              legacy[1],
              { name: "Corrected used label" },
              ctx(),
            );
            assert.equal(used.dimension, null);
            await assert.rejects(
              updater.update(scope, legacy[1], { precision: 0 }, ctx()),
              (error) => error.code === "INVENTORY_UNIT_DEFINITION_LOCKED",
            );
            assert.equal(
              await db.inventoryUnit.count({
                where: { tenantId: legacyTenantId, dimension: null },
              }),
              2,
            );
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
            "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy','unit-update-legacy',now()) RETURNING id",
          )
        ).rows[0].id;
        for (const code of ["legacyUnused", "legacyUsed"])
          legacy.push(
            (
              await database.query(
                "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,$2,$2,6) RETURNING id",
                [legacyTenantId, code],
              )
            ).rows[0].id,
          );
        await database.query(
          "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Old item',$2,0.000001)",
          [legacyTenantId, legacy[1]],
        );
      },
    },
  );
});
