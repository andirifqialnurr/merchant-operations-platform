import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaInventoryConversionWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-conversion-writer.ts";
import { pair, waitForBlocked } from "./inventory-conversion-fixture.mjs";

async function rejected(promise, constraint) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, "23514");
    assert.equal(error.constraint, constraint);
    return true;
  });
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

test("conversion compatibility DB guard preserves legacy history and locks current parents", async (t) => {
  let tenantId;
  const legacy = [];
  let before;
  await withDisposablePostgres(
    async ({ connectionString, database, createClient }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const writer = new PrismaInventoryConversionWriter();
        const actorId = randomUUID();
        const scope = { tenantId, actorId };
        const attempt = () => ({
          idempotencyKey: `legacy:${randomUUID()}`,
          origin: { actorId, channel: "API" },
        });

        await t.test(
          "function upgrade never rewrites units, old incompatible conversions, audits or replay results",
          async () => {
            assert.deepEqual(await snapshot(database), before);
            assert.equal(await db.inventoryUnitConversion.count({ where: { tenantId } }), 1);
            await rejected(
              database.query(
                "UPDATE inventory_unit_conversions SET factor = factor WHERE tenant_id = $1",
                [tenantId],
              ),
              "inventory_unit_conversions_dimensions_check",
            );
            assert.deepEqual(await snapshot(database), before);
          },
        );

        await t.test(
          "unknown/unknown and unknown/known parents cannot create a new definition through writer or SQL",
          async () => {
            const known = await pair(db, tenantId);
            for (const [fromUnitId, toUnitId] of [
              [legacy[0], legacy[2]],
              [legacy[2], legacy[0]],
              [legacy[2], known.fromUnitId],
              [known.fromUnitId, legacy[2]],
            ]) {
              const ctx = attempt();
              await assert.rejects(
                writer.create(scope, { fromUnitId, toUnitId, factor: "1" }, ctx),
                (error) => error.code === "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
              );
              await rejected(
                database.query(
                  "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
                  [tenantId, fromUnitId, toUnitId],
                ),
                "inventory_unit_conversions_dimensions_check",
              );
              assert.equal(
                await db.idempotencyKey.count({ where: { tenantId, key: ctx.idempotencyKey } }),
                0,
              );
            }
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: legacy[2] } }))
                .definitionLocked,
              false,
            );
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: known.fromUnitId } }))
                .definitionLocked,
              false,
            );
          },
        );

        await t.test(
          "raw SQL also refuses mismatched known dimensions and leaves parents unlatched",
          async () => {
            const body = await pair(db, tenantId, ["MASS", "VOLUME"]);
            await rejected(
              database.query(
                "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
                [tenantId, body.fromUnitId, body.toUnitId],
              ),
              "inventory_unit_conversions_dimensions_check",
            );
            assert.equal(
              await db.inventoryUnit.count({
                where: {
                  tenantId,
                  id: { in: [body.fromUnitId, body.toUnitId] },
                  definitionLocked: true,
                },
              }),
              0,
            );
            const compatible = await pair(db, tenantId);
            const result = await writer.create(scope, compatible, attempt());
            await database.query("UPDATE inventory_unit_conversions SET factor = 2 WHERE id = $1", [
              result.id,
            ]);
            assert.equal(
              (
                await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: result.id } })
              ).factor.toFixed(),
              "2",
            );
          },
        );

        await t.test(
          "composite foreign keys remain authoritative for absent/cross-workspace parents",
          async () => {
            const local = await pair(db, tenantId);
            const other = await db.tenant.create({
              data: { name: "Foreign", slug: "conversion-guard-foreign" },
            });
            const foreign = await pair(db, other.id);
            for (const toUnitId of [foreign.toUnitId, randomUUID()])
              await assert.rejects(
                database.query(
                  "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
                  [tenantId, local.fromUnitId, toUnitId],
                ),
                (error) => error.code === "23503",
              );
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: local.fromUnitId } }))
                .definitionLocked,
              false,
            );
          },
        );

        await t.test(
          "concurrent legacy classification is observed after locking, not guessed from a stale parent read",
          async () => {
            const client = createClient();
            await client.connect();
            const known = await pair(db, tenantId, ["COUNT", "COUNT"]);
            let pending;
            try {
              await client.query("BEGIN");
              await client.query("UPDATE inventory_units SET dimension = 'COUNT' WHERE id = $1", [
                legacy[2],
              ]);
              const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              const ctx = attempt();
              pending = writer
                .create(
                  scope,
                  { fromUnitId: legacy[2], toUnitId: known.fromUnitId, factor: "12" },
                  ctx,
                )
                .then(
                  (value) => ({ value }),
                  (error) => ({ error }),
                );
              await waitForBlocked(database, pid);
              await client.query("COMMIT");
              assert.ok((await pending).value);
              const unit = await db.inventoryUnit.findUniqueOrThrow({ where: { id: legacy[2] } });
              assert.equal(unit.dimension, "COUNT");
              assert.equal(unit.definitionLocked, true);
              await rejected(
                database.query("UPDATE inventory_units SET dimension = 'MASS' WHERE id = $1", [
                  legacy[2],
                ]),
                "inventory_units_dimension_immutable_check",
              );
            } finally {
              await client.query("ROLLBACK");
              await pending;
              await client.end();
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
        if (directory === "20261021020000_inventory_unit_dimension") {
          tenantId = (
            await database.query(
              "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy','conversion-legacy',now()) RETURNING id",
            )
          ).rows[0].id;
          for (const code of ["kg", "L", "pack"])
            legacy.push(
              (
                await database.query(
                  "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,$2,$2,6) RETURNING id",
                  [tenantId, code],
                )
              ).rows[0].id,
            );
          await database.query(
            "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
            [tenantId, legacy[0], legacy[1]],
          );
        }
        if (directory === "20261021030000_inventory_conversion_compatibility")
          before = await snapshot(database);
      },
    },
  );
});
