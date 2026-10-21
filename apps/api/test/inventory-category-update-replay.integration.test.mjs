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
} from "./inventory-category-update-fixture.mjs";

async function waitForQueuedReader(database, readerPid, blockers) {
  const deadline = Date.now() + 5_000;
  do {
    const actual = (
      await database.query("SELECT pg_blocking_pids($1::int) AS blockers", [readerPid])
    ).rows[0].blockers;
    if (actual.some((pid) => blockers.includes(pid))) return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected the specific reader to wait on the writer or its queued status editor");
}

test("category rename replay and row locks preserve original results and concurrent status changes", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database, createClient }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const { a, b, command, creator, query } = await fixture(db);

      await t.test(
        "normalized target/name/key retry returns original name/status after later changes without rewriting create result/audits",
        async () => {
          const createCtx = attempt(a);
          const createBody = { name: "Original create label" };
          const original = await creator.execute(createBody, createCtx);
          const key = `normalized:${randomUUID()}`;
          const first = await command.execute(
            original.id.toUpperCase(),
            { name: " First rename " },
            attempt(a, ` ${key} `),
          );
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key },
          });
          await command.execute(original.id, { name: "Latest rename" }, attempt(a));
          await db.inventoryCategory.update({
            where: { id: original.id },
            data: { status: "INACTIVE" },
          });
          const before = await snapshot(db, a.tenantId);
          assert.deepEqual(
            await command.execute(original.id, { name: "First rename" }, attempt(a, key)),
            first,
          );
          assert.equal(first.status, "ACTIVE");
          assert.deepEqual(await creator.execute(createBody, createCtx), original);
          assert.deepEqual(await snapshot(db, a.tenantId), before);
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
          assert.deepEqual((await query.execute({ status: "INACTIVE" }, a)).items, [
            { id: original.id, name: "Latest rename", status: "INACTIVE" },
          ]);
          await denied(
            command.execute(original.id, { name: "FIRST RENAME" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
        },
      );

      await t.test(
        "key includes target/name and stays separate across workspace/actor/create operation",
        async () => {
          const key = `shared:${randomUUID()}`;
          const createBody = { name: "Operation original" };
          const original = await creator.execute(createBody, attempt(a, key));
          const otherTarget = await category(db, a);
          const foreign = await category(db, b);
          const first = await command.execute(
            original.id,
            { name: "Operation renamed" },
            attempt(a, key),
          );
          await denied(
            command.execute(otherTarget.id, { name: "Operation renamed" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
          await denied(
            command.execute(original.id, { name: "Different body" }, attempt(a, key)),
            "IDEMPOTENCY_KEY_REUSED",
          );
          assert.notEqual(
            (await command.execute(foreign.id, { name: "Foreign rename" }, attempt(b, key))).id,
            first.id,
          );
          const user = await db.user.create({
            data: {
              displayName: "Other owner",
              email: "category-rename-owner@example.test",
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
            (
              await command.execute(
                original.id,
                { name: "Other actor renamed" },
                attempt(other, key),
              )
            ).name,
            "Other actor renamed",
          );
          assert.deepEqual(
            await command.execute(original.id, { name: "Operation renamed" }, attempt(a, key)),
            first,
          );
          assert.deepEqual(await creator.execute(createBody, attempt(a, key)), original);
          assert.equal(
            (await db.inventoryCategory.findUniqueOrThrow({ where: { id: original.id } })).name,
            "Other actor renamed",
          );
        },
      );

      await t.test(
        "uncertain/expired/incomplete/mismatched target/name/status-enum or leaked saved results fail closed without reapply",
        async () => {
          const original = await category(db, a);
          const foreign = await category(db, b);
          const ctx = attempt(a);
          const patch = { name: "Reserved rename" };
          const result = await command.execute(original.id, patch, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          await command.execute(original.id, { name: "Current later value" }, attempt(a));
          const rowsBefore = await db.inventoryCategory.findMany({ orderBy: { id: "asc" } });
          const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
          for (const [data, expected] of [
            [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
            [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
            [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
            [{ responseStatus: 201 }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, name: "Wrong name" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, status: "ARCHIVED" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: randomUUID() } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [
              { responseBody: { ...result, tenantId: a.tenantId } },
              "IDEMPOTENCY_RESULT_UNAVAILABLE",
            ],
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
            await db.inventoryCategory.findMany({ orderBy: { id: "asc" } }),
            rowsBefore,
          );
          assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: "asc" } }), auditsBefore);
        },
      );

      await t.test(
        "different-key concurrent renames serialize and preserve server status with two distinct successful audit records",
        async () => {
          const original = await category(db, a, { status: "INACTIVE" });
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.all([
            command.execute(original.id, { name: "Concurrent one" }, contexts[0]),
            command.execute(original.id, { name: "Concurrent two" }, contexts[1]),
          ]);
          assert.deepEqual(
            results.map((row) => row.name),
            ["Concurrent one", "Concurrent two"],
          );
          assert.ok(results.every((row) => row.status === "INACTIVE"));
          const final = await db.inventoryCategory.findUniqueOrThrow({
            where: { id: original.id },
          });
          assert.ok(["Concurrent one", "Concurrent two"].includes(final.name));
          assert.equal(final.status, "INACTIVE");
          assert.equal(
            await db.auditLog.count({
              where: {
                tenantId: a.tenantId,
                entityId: original.id,
                action: "inventory.category.update",
              },
            }),
            2,
          );
          for (const [i, ctx] of contexts.entries())
            assert.deepEqual(
              await command.execute(original.id, { name: results[i].name }, ctx),
              results[i],
            );
        },
      );

      await t.test(
        "waiting rename reads newly committed status/name after lock, including no-op, without restoring stale status",
        async () => {
          for (const noOp of [false, true]) {
            const original = await category(db, a);
            const desired = `Desired ${noOp}`;
            const client = createClient();
            await client.connect();
            let pending;
            try {
              await client.query("BEGIN");
              await client.query(
                "UPDATE inventory_categories SET name = $1, status = 'INACTIVE', updated_at = now() WHERE id = $2",
                [noOp ? desired : `External ${noOp}`, original.id],
              );
              const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              pending = command.execute(original.id, { name: desired }, attempt(a)).then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              await waitForBlocked(database, pid);
              const beforeCommit = (
                await client.query(
                  "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_categories WHERE id = $1",
                  [original.id],
                )
              ).rows[0].stamp;
              await client.query("COMMIT");
              const result = (await pending).value;
              assert.equal(result?.status, "INACTIVE");
              assert.equal(result?.name, desired);
              const row = await db.inventoryCategory.findUniqueOrThrow({
                where: { id: original.id },
              });
              assert.equal(row.status, "INACTIVE");
              assert.equal(
                await db.auditLog.count({
                  where: {
                    tenantId: a.tenantId,
                    entityId: original.id,
                    action: "inventory.category.update",
                  },
                }),
                noOp ? 0 : 1,
              );
              // Compare exact SQL epoch text on both sides, not Date values from
              // pg and Prisma drivers that may decode time zones differently.
              if (noOp)
                assert.equal(
                  (
                    await database.query(
                      "SELECT extract(epoch from updated_at)::text AS stamp FROM inventory_categories WHERE id = $1",
                      [original.id],
                    )
                  ).rows[0].stamp,
                  beforeCommit,
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
        "rename holds row lock through critical audit; following status editor and reader wait until commit",
        async () => {
          const original = await category(db, a);
          const barrier = createClient();
          const statusEditor = createClient();
          const reader = createClient();
          await barrier.connect();
          await statusEditor.connect();
          await reader.connect();
          const readerPid = (await reader.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
          const editorPid = (await statusEditor.query("SELECT pg_backend_pid() AS pid")).rows[0]
            .pid;
          let pending;
          let editing;
          let reading;
          try {
            await barrier.query("SELECT pg_advisory_lock(846296)");
            const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            await database.query(`CREATE FUNCTION test_category_update_barrier() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.category.update' THEN PERFORM pg_advisory_xact_lock(846296); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER test_category_update_barrier BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_category_update_barrier();`);
            pending = command.execute(original.id, { name: "Barrier renamed" }, attempt(a)).then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            const writerPid = await waitForBlocked(database, pid);
            editing = statusEditor
              .query("UPDATE inventory_categories SET status = 'INACTIVE' WHERE id = $1", [
                original.id,
              ])
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            await waitForBlocked(database, writerPid);
            reading = reader
              .query("SELECT name FROM inventory_categories WHERE id = $1 FOR NO KEY UPDATE", [
                original.id,
              ])
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            await waitForQueuedReader(database, readerPid, [writerPid, editorPid]);
            await barrier.query("SELECT pg_advisory_unlock(846296)");
            assert.equal((await pending).value?.status, "ACTIVE");
            assert.equal((await editing).value?.rowCount, 1);
            assert.equal((await reading).value?.rows[0].name, "Barrier renamed");
            const final = await db.inventoryCategory.findUniqueOrThrow({
              where: { id: original.id },
            });
            assert.equal(final.name, "Barrier renamed");
            assert.equal(final.status, "INACTIVE");
          } finally {
            await barrier.query("SELECT pg_advisory_unlock_all()");
            await pending;
            await editing;
            await reading;
            await database.query(
              "DROP TRIGGER IF EXISTS test_category_update_barrier ON audit_logs; DROP FUNCTION IF EXISTS test_category_update_barrier()",
            );
            await barrier.end();
            await statusEditor.end();
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
