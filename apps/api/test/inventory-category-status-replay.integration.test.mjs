import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import {
  attempt,
  category,
  denied,
  fixture,
  scopeOf,
  snapshot,
  waitForBlocked,
} from "./inventory-category-status-fixture.mjs";

async function waitForQueuedReader(database, readerPid, blockers) {
  const deadline = Date.now() + 5_000;
  do {
    const actual = (
      await database.query("SELECT pg_blocking_pids($1::int) AS blockers", [readerPid])
    ).rows[0].blockers;
    if (actual.some((pid) => blockers.includes(pid))) return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected the specific reader to wait on lifecycle writer or queued renamer");
}

test("category lifecycle replay preserves original outcomes while row locks serialize status and rename", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database, createClient }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, command, creator, renamer, query } = await fixture(db);

      await t.test(
        "normalized lifecycle replay keeps original name/status and does not rewrite create or rename snapshots",
        async () => {
          const originalBody = { name: "Lifecycle original" };
          const createCtx = attempt(a);
          const original = await creator.execute(originalBody, createCtx);
          const renameCtx = attempt(a);
          const renamed = await renamer.execute(
            original.id,
            { name: "Before lifecycle" },
            renameCtx,
          );
          const key = `normalized:${randomUUID()}`;
          const first = await command.execute(
            original.id.toUpperCase(),
            { status: "INACTIVE" },
            attempt(a, ` ${key} `),
          );
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key },
          });
          await command.execute(original.id, { status: "ACTIVE" }, attempt(a));
          await renamer.execute(original.id, { name: "Latest lifecycle label" }, attempt(a));
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(
            await command.execute(original.id, { status: "INACTIVE" }, attempt(a, key)),
            first,
          );
          assert.equal(first.name, "Before lifecycle");
          assert.equal(first.status, "INACTIVE");
          assert.deepEqual(await creator.execute(originalBody, createCtx), original);
          assert.deepEqual(
            await renamer.execute(original.id, { name: "Before lifecycle" }, renameCtx),
            renamed,
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
          assert.ok(
            (await query.execute({ status: "ACTIVE" }, a)).items.some(
              (row) => row.id === original.id && row.name === "Latest lifecycle label",
            ),
          );
        },
      );

      await t.test(
        "logical key includes target/status and remains separate across actor/workspace/create/rename/lifecycle",
        async () => {
          const key = `shared:${randomUUID()}`;
          const body = { name: "Separate operation" };
          const original = await creator.execute(body, attempt(a, key));
          const otherTarget = await category(db, a);
          const foreign = await category(db, b);
          const first = await command.execute(original.id, { status: "INACTIVE" }, attempt(a, key));
          await denied(
            command.execute(otherTarget.id, { status: "INACTIVE" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
          await denied(
            command.execute(original.id, { status: "ACTIVE" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
          assert.notEqual(
            (await command.execute(foreign.id, { status: "INACTIVE" }, attempt(b, key))).id,
            first.id,
          );
          const user = await db.user.create({
            data: {
              displayName: "Other owner",
              email: "category-status-owner@example.test",
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
            (await command.execute(original.id, { status: "ACTIVE" }, attempt(other, key))).status,
            "ACTIVE",
          );
          const renamed = await renamer.execute(
            original.id,
            { name: "Separate rename" },
            attempt(a, key),
          );
          assert.equal(renamed.status, "ACTIVE");
          assert.deepEqual(
            await command.execute(original.id, { status: "INACTIVE" }, attempt(a, key)),
            first,
          );
          assert.deepEqual(await creator.execute(body, attempt(a, key)), original);
          assert.equal(
            (await db.inventoryCategory.findUniqueOrThrow({ where: { id: original.id } })).status,
            "ACTIVE",
          );
        },
      );

      await t.test(
        "uncertain/expired/incomplete/corrupt target/status/metadata results fail closed without repeating a transition",
        async () => {
          const original = await category(db, a);
          const foreign = await category(db, b);
          const ctx = attempt(a);
          const input = { status: "INACTIVE" };
          const result = await command.execute(original.id, input, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          await command.execute(original.id, { status: "ACTIVE" }, attempt(a));
          const rowsBefore = await db.inventoryCategory.findMany({ orderBy: { id: "asc" } });
          const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
          for (const [data, expected] of [
            [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
            [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
            [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
            [{ responseStatus: 201 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, status: "ACTIVE" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, status: "ARCHIVED" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, itemCount: 0 } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [
              { responseBody: { id: result.id, status: result.status } },
              "IDEMPOTENCY_RESULT_UNAVAILABLE",
            ],
            [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
          ]) {
            await db.idempotencyKey.update({ where: { id: record.id }, data });
            await denied(command.execute(original.id, input, ctx), expected);
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
            await db.inventoryCategory.findMany({ orderBy: { id: "asc" } }),
            rowsBefore,
          );
          assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
        },
      );

      await t.test(
        "opposite different-key transitions serialize a valid before/after chain, including a possible leading no-op",
        async () => {
          const original = await category(db, a);
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.all([
            command.execute(original.id, { status: "INACTIVE" }, contexts[0]),
            command.execute(original.id, { status: "ACTIVE" }, contexts[1]),
          ]);
          assert.deepEqual(
            results.map((row) => row.status),
            ["INACTIVE", "ACTIVE"],
          );
          const audits = await db.auditLog.findMany({
            where: {
              tenantId: a.tenantId,
              entityId: original.id,
              action: "inventory.category.status_change",
            },
          });
          assert.ok(audits.length === 1 || audits.length === 2);
          const deactivate = audits.find((audit) => audit.metadata.after.status === "INACTIVE");
          assert.equal(deactivate.metadata.before.status, "ACTIVE");
          if (audits.length === 2)
            assert.equal(
              audits.find((audit) => audit.metadata.after.status === "ACTIVE").metadata.before
                .status,
              "INACTIVE",
            );
          const final = await db.inventoryCategory.findUniqueOrThrow({
            where: { id: original.id },
          });
          assert.equal(final.status, audits.length === 2 ? "ACTIVE" : "INACTIVE");
          assert.equal(final.name, original.name);
          const before = await snapshot(db, a.tenantId);
          for (const [i, ctx] of contexts.entries())
            assert.deepEqual(
              await command.execute(original.id, { status: results[i].status }, ctx),
              results[i],
            );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "rename and lifecycle in parallel retain both changes and keep separate original results",
        async () => {
          const original = await category(db, a);
          const statusCtx = attempt(a);
          const renameCtx = attempt(a);
          const [statusResult, renameResult] = await Promise.all([
            command.execute(original.id, { status: "INACTIVE" }, statusCtx),
            renamer.execute(original.id, { name: "Concurrent lifecycle label" }, renameCtx),
          ]);
          const final = await db.inventoryCategory.findUniqueOrThrow({
            where: { id: original.id },
          });
          assert.equal(final.name, "Concurrent lifecycle label");
          assert.equal(final.status, "INACTIVE");
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.status_change",
              },
            }),
            1,
          );
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
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(
            await command.execute(original.id, { status: "INACTIVE" }, statusCtx),
            statusResult,
          );
          assert.deepEqual(
            await renamer.execute(original.id, { name: "Concurrent lifecycle label" }, renameCtx),
            renameResult,
          );
          assert.deepEqual(await snapshot(db, a.tenantId), before);
        },
      );

      await t.test(
        "waiting lifecycle uses newly committed name/status after row lock, including an exact timestamp-preserving no-op",
        async () => {
          for (const status of ["ACTIVE", "INACTIVE"]) {
            const original = await category(db, a);
            const client = createClient();
            await client.connect();
            let pending;
            try {
              await client.query("BEGIN");
              await client.query(
                "UPDATE inventory_categories SET name = $1, status = $2, updated_at = now() WHERE id = $3",
                [`External ${status}`, status, original.id],
              );
              const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              pending = command.execute(original.id, { status: "INACTIVE" }, attempt(a)).then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              await waitForBlocked(database, pid);
              const stamp = (
                await client.query(
                  "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_categories WHERE id = $1",
                  [original.id],
                )
              ).rows[0].stamp;
              await client.query("COMMIT");
              const result = (await pending).value;
              assert.equal(result?.status, "INACTIVE");
              assert.equal(result?.name, `External ${status}`);
              const audits = await db.auditLog.findMany({
                where: {
                  tenantId: a.tenantId,
                  entityId: original.id,
                  action: "inventory.category.status_change",
                },
              });
              assert.equal(audits.length, status === "INACTIVE" ? 0 : 1);
              if (audits.length) assert.equal(audits[0].metadata.before.status, status);
              else
                assert.equal(
                  (
                    await database.query(
                      "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_categories WHERE id = $1",
                      [original.id],
                    )
                  ).rows[0].stamp,
                  stamp,
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
        "critical lifecycle audit holds the row lock until commit while authorized rename and exact reader PID wait",
        async () => {
          const original = await category(db, a);
          const barrier = createClient();
          const reader = createClient();
          await barrier.connect();
          await reader.connect();
          const readerPid = (await reader.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
          let pending;
          let renaming;
          let reading;
          try {
            await barrier.query("SELECT pg_advisory_lock(846297)");
            const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            await database.query(`CREATE FUNCTION test_category_status_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.category.status_change' THEN PERFORM pg_advisory_xact_lock(846297); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_category_status_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_category_status_barrier();`);
            pending = command.execute(original.id, { status: "INACTIVE" }, attempt(a)).then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            const writerPid = await waitForBlocked(database, pid);
            renaming = renamer
              .execute(original.id, { name: "After lifecycle commit" }, attempt(a))
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            const renamerPid = await waitForBlocked(database, writerPid);
            reading = reader
              .query("SELECT status FROM inventory_categories WHERE id = $1 FOR NO KEY UPDATE", [
                original.id,
              ])
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            await waitForQueuedReader(database, readerPid, [writerPid, renamerPid]);
            await barrier.query("SELECT pg_advisory_unlock(846297)");
            assert.equal((await pending).value?.status, "INACTIVE");
            assert.equal((await renaming).value?.status, "INACTIVE");
            assert.equal((await reading).value?.rows[0].status, "INACTIVE");
            const final = await db.inventoryCategory.findUniqueOrThrow({
              where: { id: original.id },
            });
            assert.equal(final.name, "After lifecycle commit");
            assert.equal(final.status, "INACTIVE");
          } finally {
            await barrier.query("SELECT pg_advisory_unlock_all()");
            await pending;
            await renaming;
            await reading;
            await database.query(
              "DROP TRIGGER IF EXISTS test_category_status_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_category_status_barrier()",
            );
            await barrier.end();
            await reader.end();
          }
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
