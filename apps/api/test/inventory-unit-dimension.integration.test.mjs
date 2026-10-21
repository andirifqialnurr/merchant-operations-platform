import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaInventoryMasterReader } from "../src/modules/inventory/adapters/persistence/prisma-inventory-master-reader.ts";
import { PrismaInventoryUnitWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-writer.ts";
import { haveCompatibleInventoryUnitDimensions } from "../src/modules/inventory/domain/unit-dimension.ts";

const migration = "20261021020000_inventory_unit_dimension";
const legacyBody = { code: "g", name: "Gram", precision: 6 };
const actorId = randomUUID();
const key = `legacy:${randomUUID()}`;
let tenantId;
let legacy;
let before;

async function rejected(query, constraint) {
  await assert.rejects(query, (error) => {
    assert.equal(error.code, "23514");
    assert.equal(error.constraint, constraint);
    return true;
  });
}
async function waitForBlocked(database, pid) {
  const deadline = Date.now() + 5_000;
  do {
    if (
      (
        await database.query(
          "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND NOT granted) AS blocked",
          [pid],
        )
      ).rows[0].blocked
    )
      return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected a row lock wait");
}
async function snapshot(database) {
  const result = {};
  for (const table of [
    "inventory_units",
    "inventory_unit_conversions",
    "audit_logs",
    "idempotency_keys",
  ])
    result[table] = (await database.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  return result;
}

// Only the invocation-owned disposable database receives historical rows or DDL.
test("explicit Inventory dimensions preserve unknown history and fence reinterpretation", async (t) => {
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const writer = new PrismaInventoryUnitWriter();
        const scope = { tenantId, actorId };
        const attempt = { idempotencyKey: key, origin: { actorId, channel: "WEB" } };

        await t.test(
          "upgrade adds only null classification; codes, reference latches, conversion, audit and replay stay unchanged",
          async () => {
            const after = await snapshot(database);
            assert.deepEqual(
              after.inventory_units,
              before.inventory_units.map((row) => ({ ...row, dimension: null })),
            );
            for (const table of ["inventory_unit_conversions", "audit_logs", "idempotency_keys"])
              assert.deepEqual(after[table], before[table]);
            assert.equal(after.inventory_units.filter((row) => row.definition_locked).length, 2);
            const rows = await new PrismaInventoryMasterReader().listUnits(
              { tenantId },
              { limit: 25 },
            );
            assert.equal(rows.length, 3);
            assert.ok(rows.every((row) => row.dimension === null));
            assert.equal(
              haveCompatibleInventoryUnitDimensions(rows[0].dimension, rows[1].dimension),
              false,
            );
            assert.deepEqual(
              await new PrismaInventoryMasterReader().listUnits(
                { tenantId: randomUUID() },
                { limit: 25 },
              ),
              [],
            );
          },
        );

        await t.test(
          "new SQL/Prisma inserts require a known dimension without guessing from g/kg",
          async () => {
            for (const dimension of [undefined, null]) {
              await assert.rejects(
                db.inventoryUnit.create({
                  data: { tenantId, code: "kg", name: "Kilogram", precision: 6, dimension },
                }),
              );
            }
            await rejected(
              database.query(
                "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,'kg','Kilogram',6)",
                [tenantId],
              ),
              "inventory_units_dimension_required_check",
            );
            for (const dimension of ["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"]) {
              const unit = await writer.create(
                scope,
                { code: dimension, name: dimension, precision: 6, dimension },
                { ...attempt, idempotencyKey: `dimension-create:${dimension}` },
              );
              assert.equal(unit.dimension, dimension);
              const audit = await db.auditLog.findFirstOrThrow({
                where: { tenantId, entityId: unit.id },
              });
              assert.deepEqual(audit.metadata, {
                critical: true,
                after: { code: dimension, precision: 6, dimension },
              });
              const replay = await db.idempotencyKey.findFirstOrThrow({
                where: { tenantId, key: `dimension-create:${dimension}` },
              });
              assert.deepEqual(replay.responseBody, unit);
            }
            await assert.rejects(
              database.query(
                "INSERT INTO inventory_units (tenant_id,code,name,precision,dimension) VALUES ($1,'other','Other',0,'OTHER')",
                [tenantId],
              ),
              (error) => error.code === "22P02",
            );
          },
        );

        await t.test(
          "known dimension is immutable even before references; legacy referenced unknown cannot be silently classified",
          async () => {
            const mass = await db.inventoryUnit.findFirstOrThrow({
              where: { tenantId, code: "MASS" },
            });
            for (const dimension of ["VOLUME", null])
              await rejected(
                database.query("UPDATE inventory_units SET dimension = $1 WHERE id = $2", [
                  dimension,
                  mass.id,
                ]),
                "inventory_units_dimension_immutable_check",
              );
            for (const row of legacy.slice(0, 2))
              await rejected(
                database.query("UPDATE inventory_units SET dimension = 'MASS' WHERE id = $1", [
                  row.id,
                ]),
                "inventory_units_dimension_immutable_check",
              );
            await db.inventoryUnit.update({
              where: { id: mass.id },
              data: { name: "Corrected label" },
            });
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: mass.id } })).dimension,
              "MASS",
            );
            const unused = legacy[2];
            await database.query("BEGIN");
            try {
              await database.query("UPDATE inventory_units SET dimension = 'MASS' WHERE id = $1", [
                unused.id,
              ]);
              assert.equal(
                (
                  await database.query("SELECT dimension FROM inventory_units WHERE id = $1", [
                    unused.id,
                  ])
                ).rows[0].dimension,
                "MASS",
              );
            } finally {
              await database.query("ROLLBACK");
            }
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: unused.id } })).dimension,
              null,
            );
          },
        );

        await t.test(
          "old logical hashes and incomplete snapshots remain reserved and fail closed, never rewritten",
          async () => {
            const saved = await db.idempotencyKey.findFirstOrThrow({ where: { tenantId, key } });
            const counts = [await db.inventoryUnit.count(), await db.auditLog.count()];
            const input = { ...legacyBody, dimension: "MASS" };
            await assert.rejects(
              writer.create(scope, input, attempt),
              (error) => error.code === "IDEMPOTENCY_KEY_REUSED",
            );
            assert.deepEqual(
              await db.idempotencyKey.findUniqueOrThrow({ where: { id: saved.id } }),
              saved,
            );
            // Simulates a damaged/incomplete result under the new logical hash.
            await db.idempotencyKey.update({
              where: { id: saved.id },
              data: {
                requestHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
              },
            });
            await assert.rejects(
              writer.create(scope, input, attempt),
              (error) => error.code === "IDEMPOTENCY_RESULT_UNAVAILABLE",
            );
            assert.deepEqual([await db.inventoryUnit.count(), await db.auditLog.count()], counts);
            assert.deepEqual(
              (await db.idempotencyKey.findUniqueOrThrow({ where: { id: saved.id } })).responseBody,
              saved.responseBody,
            );
          },
        );

        await t.test(
          "dimension participates in logical request identity and original snapshot replay",
          async () => {
            const ctx = { ...attempt, idempotencyKey: `hash:${randomUUID()}` };
            const input = { code: "replay", name: "Replay", precision: 0, dimension: "COUNT" };
            const first = await writer.create(scope, input, ctx);
            await db.inventoryUnit.update({ where: { id: first.id }, data: { name: "Renamed" } });
            assert.deepEqual(
              await writer.create(
                scope,
                { dimension: "COUNT", precision: 0, name: "Replay", code: "replay" },
                ctx,
              ),
              first,
            );
            await assert.rejects(
              writer.create(scope, { ...input, dimension: "MASS" }, ctx),
              (error) => error.code === "IDEMPOTENCY_KEY_REUSED",
            );
          },
        );

        await t.test(
          "classification and first reference serialize without changing an already-used definition",
          async () => {
            for (const referenceFirst of [false, true]) {
              // The historical fixture is unreferenced and still unknown after rollback above.
              const id = legacy[2].id;
              const one = createClient();
              const two = createClient();
              await one.connect();
              await two.connect();
              try {
                await one.query("BEGIN");
                await two.query("BEGIN");
                const pid = (await two.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                const reference = (client) =>
                  client.query(
                    "INSERT INTO inventory_items (tenant_id,name,base_unit_id) VALUES ($1,$2,$3)",
                    [tenantId, `race-${referenceFirst}`, id],
                  );
                const classify = (client) =>
                  client.query("UPDATE inventory_units SET dimension = 'COUNT' WHERE id = $1", [
                    id,
                  ]);
                await (referenceFirst ? reference(one) : classify(one));
                const pending = (referenceFirst ? classify(two) : reference(two)).then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
                await waitForBlocked(database, pid);
                if (referenceFirst) {
                  await one.query("COMMIT");
                  const result = await pending;
                  assert.equal(
                    result.error?.constraint,
                    "inventory_units_dimension_immutable_check",
                  );
                  await two.query("ROLLBACK");
                  const final = await db.inventoryUnit.findUniqueOrThrow({ where: { id } });
                  assert.equal(final.dimension, null);
                  assert.equal(final.definitionLocked, true);
                } else {
                  // Rollback restores UNKNOWN; the reference then latches that exact state.
                  await one.query("ROLLBACK");
                  assert.ok((await pending).value);
                  await two.query("ROLLBACK");
                  const final = await db.inventoryUnit.findUniqueOrThrow({ where: { id } });
                  assert.equal(final.dimension, null);
                  assert.equal(final.definitionLocked, false);
                }
              } finally {
                await one.query("ROLLBACK");
                await two.query("ROLLBACK");
                await one.end();
                await two.end();
              }
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
        if (directory !== migration) return;
        tenantId = (
          await database.query(
            "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy units','dimension-legacy',now()) RETURNING id",
          )
        ).rows[0].id;
        legacy = [];
        for (const [code, name] of [
          ["g", "Gram"],
          ["L", "Liter"],
          ["unknown", "Unknown"],
        ])
          legacy.push(
            (
              await database.query(
                "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,$2,$3,6) RETURNING *",
                [tenantId, code, name],
              )
            ).rows[0],
          );
        await database.query(
          "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,2)",
          [tenantId, legacy[0].id, legacy[1].id],
        );
        await database.query(
          "INSERT INTO audit_logs (tenant_id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,'inventory.unit.create','inventory_unit',$3,$4)",
          [
            tenantId,
            actorId,
            legacy[0].id,
            JSON.stringify({ critical: true, after: { code: "g", precision: 6 } }),
          ],
        );
        await database.query(
          "INSERT INTO idempotency_keys (tenant_id,scope,key,request_hash,status,response_status,response_body,expires_at,updated_at) VALUES ($1,$2,$3,$4,'COMPLETED',201,$5,now()+interval '1 day',now())",
          [
            tenantId,
            `inventory.unit.create:${actorId}`,
            key,
            createHash("sha256").update(JSON.stringify(legacyBody)).digest("hex"),
            JSON.stringify({ id: legacy[0].id, ...legacyBody }),
          ],
        );
        before = await snapshot(database);
      },
    },
  );
});
