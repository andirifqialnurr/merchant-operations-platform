import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import {
  attempt,
  conversion,
  denied,
  fixture,
  pair,
  scopeOf,
  snapshot,
  waitForBlocked,
} from "./inventory-conversion-update-fixture.mjs";

const legacy = [];
let legacyTenantId;

test("factor updates preserve original snapshots and serialize compatible parent/pair access", async (t) => {
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const { a, b, updater, command, creator } = await fixture(db);

        await t.test(
          "normalized update replay returns the original factor while create/earlier audit snapshots remain unchanged",
          async () => {
            const body = await pair(db, a.tenantId);
            const createCtx = attempt(a);
            const original = await creator.execute(body, createCtx);
            const key = `normalized:${randomUUID()}`;
            const first = await command.execute(
              original.id.toUpperCase(),
              { factor: "2.500000000000" },
              attempt(a, ` ${key} `),
            );
            await command.execute(original.id, { factor: "3" }, attempt(a));
            const before = await snapshot(db, a.tenantId);
            assert.deepEqual(
              await command.execute(original.id, { factor: "2.5" }, attempt(a, key)),
              first,
            );
            assert.deepEqual(await creator.execute(body, createCtx), original);
            assert.deepEqual(await snapshot(db, a.tenantId), before);
            assert.equal(
              (
                await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: original.id } })
              ).factor.toFixed(),
              "3",
            );
          },
        );

        await t.test(
          "key includes target/body and stays isolated across actor/tenant/create operation",
          async () => {
            const key = `shared:${randomUUID()}`;
            const body = await pair(db, a.tenantId);
            const original = await creator.execute(body, attempt(a, key));
            const otherTarget = await conversion(db, a);
            const foreign = await conversion(db, b);
            const first = await command.execute(original.id, { factor: "2" }, attempt(a, key));
            await denied(
              command.execute(otherTarget.id, { factor: "2" }, attempt(a, key)),
              "IDEMPOTENCY_KEY_REUSED",
            );
            await denied(
              command.execute(original.id, { factor: "3" }, attempt(a, key)),
              "IDEMPOTENCY_KEY_REUSED",
            );
            assert.notEqual(
              (await command.execute(foreign.id, { factor: "4" }, attempt(b, key))).id,
              first.id,
            );
            const user = await db.user.create({
              data: {
                displayName: "Other",
                email: "factor-update-other@example.test",
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
            assert.equal(
              (await command.execute(original.id, { factor: "5" }, attempt(other, key))).factor,
              "5",
            );
            assert.deepEqual(
              await command.execute(original.id, { factor: "2" }, attempt(a, key)),
              first,
            );
            assert.equal((await creator.execute(body, attempt(a, key))).factor, "1000");
          },
        );

        await t.test(
          "uncertain/expired/incomplete/corrupt/noncanonical or wrong-binding saved results never reapply a factor",
          async () => {
            const original = await conversion(db, a);
            const other = await conversion(db, a);
            const foreign = await conversion(db, b);
            const ctx = attempt(a);
            const patch = { factor: "2" };
            const result = await command.execute(original.id, patch, ctx);
            const record = await db.idempotencyKey.findFirstOrThrow({
              where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
            });
            await command.execute(original.id, { factor: "3" }, attempt(a));
            const rowsBefore = await db.inventoryUnitConversion.findMany({
              orderBy: { id: "asc" },
            });
            const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
            for (const [data, expected] of [
              [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
              [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
              [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
              [{ responseStatus: 201 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, factor: "3" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, factor: "2.0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { ...result, fromUnitId: other.fromUnitId } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...result, toUnitId: other.toUnitId } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [
                { responseBody: { ...result, tenantId: a.tenantId } },
                "IDEMPOTENCY_RESULT_UNAVAILABLE",
              ],
              [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
              [
                { responseBody: { id: result.id, factor: result.factor } },
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
              await db.inventoryUnitConversion.findMany({ orderBy: { id: "asc" } }),
              rowsBefore,
            );
            assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
          },
        );

        await t.test(
          "different-key concurrent updates serialize their real before/after audit chain",
          async () => {
            const original = await conversion(db, a);
            await Promise.all([
              command.execute(original.id, { factor: "2" }, attempt(a)),
              command.execute(original.id, { factor: "3" }, attempt(a)),
            ]);
            const audits = await db.auditLog.findMany({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.unit_conversion.update",
              },
            });
            assert.equal(audits.length, 2);
            const first = audits.find((audit) => audit.metadata.before.factor === "1000");
            assert.ok(first);
            const second = audits.find((audit) => audit.id !== first.id);
            assert.equal(second.metadata.before.factor, first.metadata.after.factor);
            assert.equal(
              (
                await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: original.id } })
              ).factor.toFixed(),
              second.metadata.after.factor,
            );
          },
        );

        await t.test(
          "explicit reverse-pair updates and duplicate create use the same parent lock order without deadlock",
          async () => {
            const original = await conversion(db, a);
            const reverse = await db.inventoryUnitConversion.create({
              data: {
                tenantId: a.tenantId,
                fromUnitId: original.toUnitId,
                toUnitId: original.fromUnitId,
                factor: "0.001",
              },
            });
            const results = await Promise.allSettled([
              command.execute(original.id, { factor: "2" }, attempt(a)),
              command.execute(reverse.id, { factor: "3" }, attempt(a)),
              creator.execute(
                { fromUnitId: original.fromUnitId, toUnitId: original.toUnitId, factor: "4" },
                attempt(a),
              ),
            ]);
            assert.equal(results[0].status, "fulfilled");
            assert.equal(results[1].status, "fulfilled");
            assert.equal(results[2].status, "rejected");
            assert.equal(results[2].reason.getResponse().code, "INVENTORY_CONVERSION_PAIR_TAKEN");
            assert.equal(
              (
                await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: original.id } })
              ).factor.toFixed(),
              "2",
            );
            assert.equal(
              (
                await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: reverse.id } })
              ).factor.toFixed(),
              "3",
            );
          },
        );

        await t.test(
          "blocked updater reads before factor only after locks, including no-op against a newly committed value",
          async () => {
            for (const committed of ["5", "7"]) {
              const original = await conversion(db, a);
              const client = createClient();
              await client.connect();
              let pending;
              try {
                await client.query("BEGIN");
                await client.query(
                  "UPDATE inventory_unit_conversions SET factor = $1 WHERE id = $2",
                  [committed, original.id],
                );
                const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                pending = command.execute(original.id, { factor: "7" }, attempt(a)).then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
                await waitForBlocked(database, pid);
                await client.query("COMMIT");
                assert.equal((await pending).value?.factor, "7");
                const audits = await db.auditLog.findMany({
                  where: {
                    tenantId: a.tenantId,
                    entityId: original.id,
                    action: "inventory.unit_conversion.update",
                  },
                });
                assert.equal(audits.length, committed === "7" ? 0 : 1);
                if (audits.length) assert.equal(audits[0].metadata.before.factor, committed);
              } finally {
                await client.query("ROLLBACK");
                await pending;
                await client.end();
              }
            }
          },
        );

        await t.test(
          "parent and conversion locks are retained through critical audit until commit",
          async () => {
            const original = await conversion(db, a);
            const barrier = createClient();
            const parentEditor = createClient();
            const pairReader = createClient();
            await barrier.connect();
            await parentEditor.connect();
            await pairReader.connect();
            const readerPid = (await pairReader.query("SELECT pg_backend_pid() AS pid")).rows[0]
              .pid;
            let pending;
            let editing;
            let reading;
            try {
              await barrier.query("SELECT pg_advisory_lock(846295)");
              const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              await database.query(`CREATE FUNCTION test_factor_update_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.unit_conversion.update' THEN PERFORM pg_advisory_xact_lock(846295); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_factor_update_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_factor_update_barrier();`);
              pending = command.execute(original.id, { factor: "7" }, attempt(a)).then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              const writerPid = await waitForBlocked(database, pid);
              editing = parentEditor
                .query("UPDATE inventory_units SET name = 'Changed label' WHERE id = $1", [
                  original.fromUnitId,
                ])
                .then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
              await waitForBlocked(database, writerPid);
              reading = pairReader
                .query(
                  "SELECT factor::text AS factor FROM inventory_unit_conversions WHERE id = $1 FOR NO KEY UPDATE",
                  [original.id],
                )
                .then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
              await waitForBlocked(database, writerPid, readerPid);
              await barrier.query("SELECT pg_advisory_unlock(846295)");
              assert.equal((await pending).value?.factor, "7");
              assert.equal((await editing).value?.rowCount, 1);
              assert.equal((await reading).value?.rows[0].factor, "7");
            } finally {
              await barrier.query("SELECT pg_advisory_unlock_all()");
              await pending;
              await editing;
              await reading;
              await database.query(
                "DROP TRIGGER IF EXISTS test_factor_update_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_factor_update_barrier()",
              );
              await barrier.end();
              await parentEditor.end();
              await pairReader.end();
            }
          },
        );

        await t.test(
          "unknown and cross-dimension legacy rows are refused even for no-op without rewriting history",
          async () => {
            const actorId = randomUUID();
            const before = await snapshot(db, legacyTenantId);
            for (const id of legacy)
              for (const factor of ["1", "2"])
                await assert.rejects(
                  updater.update(
                    { tenantId: legacyTenantId, actorId },
                    id,
                    { factor },
                    {
                      idempotencyKey: `legacy-factor:${randomUUID()}`,
                      origin: { actorId, channel: "API" },
                    },
                  ),
                  (error) => error.code === "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
                );
            assert.deepEqual(await snapshot(db, legacyTenantId), before);
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
        if (directory === "20261021020000_inventory_unit_dimension") {
          legacyTenantId = (
            await database.query(
              "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy','factor-update-legacy',now()) RETURNING id",
            )
          ).rows[0].id;
          const units = [];
          for (const code of ["unknownA", "unknownB"])
            units.push(
              (
                await database.query(
                  "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,$2,$2,6) RETURNING id",
                  [legacyTenantId, code],
                )
              ).rows[0].id,
            );
          legacy.push(
            (
              await database.query(
                "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1) RETURNING id",
                [legacyTenantId, ...units],
              )
            ).rows[0].id,
          );
        }
        if (directory === "20261021030000_inventory_conversion_compatibility") {
          const units = [];
          for (const dimension of ["MASS", "VOLUME"])
            units.push(
              (
                await database.query(
                  "INSERT INTO inventory_units (tenant_id,code,name,precision,dimension) VALUES ($1,$2,$2,6,$3) RETURNING id",
                  [legacyTenantId, `known${dimension}`, dimension],
                )
              ).rows[0].id,
            );
          legacy.push(
            (
              await database.query(
                "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1) RETURNING id",
                [legacyTenantId, ...units],
              )
            ).rows[0].id,
          );
        }
      },
    },
  );
});
