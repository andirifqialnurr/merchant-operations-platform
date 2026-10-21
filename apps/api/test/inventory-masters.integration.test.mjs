import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { createPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const tables = [
  "inventory_units",
  "inventory_unit_conversions",
  "inventory_categories",
  "inventory_items",
  "inventory_suppliers",
  "inventory_stock_locations",
];
const maxQuantity = "999999999999999999999999.999999";
const maxFactor = "999999999999999999.999999999999";

async function refused(query, code = "23514") {
  await assert.rejects(query, (error) => {
    assert.equal(error.code, code, error.message);
    return true;
  });
}

async function waitForBlocked(observer, pid) {
  const deadline = Date.now() + 5_000;
  do {
    const result = await observer.query(
      "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND NOT granted) AS blocked",
      [pid],
    );
    if (result.rows[0].blocked) return;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected the writer to wait on the other transaction's row lock");
}

async function unit(db, tenantId, code, precision = 6) {
  return db.inventoryUnit.create({
    data: { tenantId, code, name: code, precision, dimension: "MASS" },
  });
}

async function fixture(db, slug) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  const tenantId = tenant.id;
  const brand = await db.brand.create({ data: { tenantId, name: "Brand", slug: "brand" } });
  const outlet = await db.outlet.create({
    data: { tenantId, brandId: brand.id, name: "Pusat", code: "PUSAT" },
  });
  const base = await unit(db, tenantId, "g");
  const pack = await unit(db, tenantId, "kg", 3);
  const category = await db.inventoryCategory.create({ data: { tenantId, name: "Bahan" } });
  return { tenantId, base, pack, category, outlet, brand };
}

// These are storage integration tests, not an application permission/limit API.
// No callback or migration is run against the supplied admin/development DB.
test("Inventory masters persist independently with exact values and scoped database guards", async (t) => {
  await withDisposablePostgres(async ({ connectionString, createClient, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = createPrismaClient();
    try {
      const a = await fixture(db, "inventory-a");
      const b = await fixture(db, "inventory-b");
      const item = await db.inventoryItem.create({
        data: {
          tenantId: a.tenantId,
          name: "Kopi",
          sku: "KOPI-01",
          categoryId: a.category.id,
          baseUnitId: a.base.id,
          minStock: maxQuantity,
        },
      });
      const conversion = await db.inventoryUnitConversion.create({
        data: {
          tenantId: a.tenantId,
          fromUnitId: a.pack.id,
          toUnitId: a.base.id,
          factor: maxFactor,
        },
      });
      const supplier = await db.inventorySupplier.create({
        data: { tenantId: a.tenantId, name: "Pemasok", contact: "sales@example.test" },
      });
      const storage = await db.inventoryStockLocation.create({
        data: { tenantId: a.tenantId, name: "Gudang" },
      });
      const outletStorage = await db.inventoryStockLocation.create({
        data: { tenantId: a.tenantId, name: "Gudang", outletId: a.outlet.id },
      });

      await t.test(
        "Prisma round trips six masters without installing Catalog/POS/KDS",
        async () => {
          for (const delegate of [
            db.catalogProduct,
            db.order,
            db.kdsTicket,
            db.coreModuleInstallation,
          ]) {
            assert.equal(await delegate.count({ where: { tenantId: a.tenantId } }), 0);
          }
          const read = await db.inventoryItem.findUniqueOrThrow({
            where: { tenantId_id: { tenantId: a.tenantId, id: item.id } },
            include: { category: true, baseUnit: true },
          });
          assert.equal(read.category.name, "Bahan");
          assert.equal(read.baseUnit.code, "g");
          assert.equal(read.baseUnit.definitionLocked, true);
          assert.ok(read.minStock.equals(maxQuantity));
          assert.equal(read.status, "ACTIVE");
          assert.ok(read.createdAt instanceof Date);
          assert.ok(read.updatedAt instanceof Date);
          assert.match(read.id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-/);
          const stored = await database.query(
            "SELECT min_stock::text AS value FROM inventory_items WHERE tenant_id = $1 AND id = $2",
            [a.tenantId, item.id],
          );
          assert.equal(stored.rows[0].value, maxQuantity);
          const readConversion = await db.inventoryUnitConversion.findUniqueOrThrow({
            where: { tenantId_id: { tenantId: a.tenantId, id: conversion.id } },
            include: { fromUnit: true, toUnit: true },
          });
          assert.ok(readConversion.factor.equals(maxFactor));
          assert.equal(readConversion.fromUnit.definitionLocked, true);
          assert.equal(readConversion.toUnit.id, a.base.id);
          assert.equal(
            await db.inventoryItem.findUnique({
              where: { tenantId_id: { tenantId: b.tenantId, id: item.id } },
            }),
            null,
          );
          assert.equal(supplier.contact, "sales@example.test");
          assert.equal(storage.outletId, null);
          const atOutlet = await db.inventoryStockLocation.findUniqueOrThrow({
            where: { tenantId_id: { tenantId: a.tenantId, id: outletStorage.id } },
            include: { outlet: true },
          });
          assert.equal(atOutlet.outlet.id, a.outlet.id);
          const types = await database.query(
            `SELECT attname, atttypmod FROM pg_attribute
           WHERE (attrelid = 'inventory_items'::regclass AND attname = 'min_stock')
              OR (attrelid = 'inventory_unit_conversions'::regclass AND attname = 'factor')`,
          );
          assert.equal(types.rows.length, 2);
          assert.ok(
            types.rows.every((row) => row.atttypmod === -1),
            "NUMERIC must not coerce scale",
          );
        },
      );

      await t.test(
        "unknown minimum/category/SKU/contact stay NULL, while explicit zero is real",
        async () => {
          const unknown = await db.inventoryItem.create({
            data: { tenantId: a.tenantId, name: "Gula", baseUnitId: a.base.id },
          });
          assert.equal(unknown.minStock, null);
          assert.equal(unknown.categoryId, null);
          assert.equal(unknown.sku, null);
          const zero = await db.inventoryItem.create({
            data: { tenantId: a.tenantId, name: "Gula", baseUnitId: a.base.id, minStock: "0" },
          });
          assert.ok(zero.minStock.equals("0"));
          const anotherSupplier = await db.inventorySupplier.create({
            data: { tenantId: a.tenantId, name: supplier.name },
          });
          assert.equal(anotherSupplier.contact, null);
          const smallest = await db.inventoryItem.create({
            data: {
              tenantId: a.tenantId,
              name: "Garam",
              baseUnitId: a.base.id,
              minStock: "0.000001",
            },
          });
          assert.ok(smallest.minStock.equals("0.000001"));
          const reverse = await db.inventoryUnitConversion.create({
            data: {
              tenantId: a.tenantId,
              fromUnitId: a.base.id,
              toUnitId: a.pack.id,
              factor: "0.000000000001",
            },
          });
          assert.ok(reverse.factor.equals("0.000000000001"));
          // Direct definitions only: neither a reciprocal nor a physical dimension is inferred.
          assert.equal(
            await db.inventoryUnitConversion.count({ where: { tenantId: a.tenantId } }),
            2,
          );
        },
      );

      await t.test(
        "excess scale, overflow, negative/special quantities and invalid factors fail, never round",
        async () => {
          for (const value of [
            "0.0000001",
            "1.0000001",
            "1.0000000",
            "1000000000000000000000000",
            "-0.000001",
            "NaN",
            "Infinity",
            "-Infinity",
          ]) {
            await refused(
              database.query(
                "UPDATE inventory_items SET min_stock = $1::numeric WHERE tenant_id = $2 AND id = $3",
                [value, a.tenantId, item.id],
              ),
            );
          }
          for (const value of [
            "0",
            "-1",
            "0.0000000000001",
            "0.0000000000009",
            "1.0000000000001",
            "1.0000000000000",
            "1000000000000000000",
            "NaN",
            "Infinity",
            "-Infinity",
          ]) {
            await refused(
              database.query(
                "UPDATE inventory_unit_conversions SET factor = $1::numeric WHERE tenant_id = $2 AND id = $3",
                [value, a.tenantId, conversion.id],
              ),
            );
          }
          // The generated Prisma client must not pre-round invalid strings either.
          for (const write of [
            () =>
              db.inventoryItem.create({
                data: {
                  tenantId: a.tenantId,
                  name: "Inexact",
                  baseUnitId: a.base.id,
                  minStock: "1.0000001",
                },
              }),
            () =>
              db.inventoryUnitConversion.update({
                where: { id: conversion.id },
                data: { factor: "1.0000000000001" },
              }),
          ]) {
            await assert.rejects(write, (error) => {
              assert.match(
                `${error.code ?? ""} ${error.message}`,
                /P2004|23514|check constraint|exceeds base unit precision/i,
              );
              return true;
            });
          }
          const preserved = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
          assert.ok(preserved.minStock.equals(maxQuantity));
          const preservedFactor = await db.inventoryUnitConversion.findUniqueOrThrow({
            where: { id: conversion.id },
          });
          assert.ok(preservedFactor.factor.equals(maxFactor));
        },
      );

      await t.test(
        "unit precision is enforced without floating point on insert and update",
        async () => {
          const pieces = await unit(db, a.tenantId, "pcs", 0);
          await refused(
            database.query(
              "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Telur',$2,1.5)",
              [a.tenantId, pieces.id],
            ),
          );
          // Failed statement must not leave the latch set.
          const afterFailure = await db.inventoryUnit.findUniqueOrThrow({
            where: { id: pieces.id },
          });
          assert.equal(afterFailure.definitionLocked, false);
          const eggs = await db.inventoryItem.create({
            data: {
              tenantId: a.tenantId,
              name: "Telur",
              baseUnitId: pieces.id,
              minStock: "1.000000",
            },
          });
          assert.ok(eggs.minStock.equals("1"));
          await refused(
            database.query(
              "UPDATE inventory_items SET min_stock = 1.000001 WHERE tenant_id = $1 AND id = $2",
              [a.tenantId, eggs.id],
            ),
          );
          const unused = await unit(db, a.tenantId, "unused", 3);
          for (const precision of [-1, 7]) {
            await refused(
              database.query(
                "UPDATE inventory_units SET precision = $1 WHERE tenant_id = $2 AND id = $3",
                [precision, a.tenantId, unused.id],
              ),
            );
          }
          await db.inventoryUnit.update({
            where: { id: unused.id },
            data: { precision: 6, code: "renamed" },
          });
        },
      );

      await t.test(
        "cross-workspace references fail and roll back first-reference latches",
        async () => {
          const unused = await unit(db, a.tenantId, "rollback");
          for (const [baseUnitId, categoryId] of [
            [b.base.id, a.category.id],
            [unused.id, b.category.id],
          ]) {
            await refused(
              database.query(
                "INSERT INTO inventory_items (tenant_id,name,base_unit_id,category_id) VALUES ($1,'Bad',$2,$3)",
                [a.tenantId, baseUnitId, categoryId],
              ),
              "23503",
            );
          }
          for (const [from, to] of [
            [unused.id, b.base.id],
            [b.base.id, unused.id],
          ]) {
            await refused(
              database.query(
                "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1)",
                [a.tenantId, from, to],
              ),
              "23503",
            );
          }
          await refused(
            database.query(
              "INSERT INTO inventory_stock_locations (tenant_id,outlet_id,name) VALUES ($1,$2,'Bad')",
              [a.tenantId, b.outlet.id],
            ),
            "23503",
          );
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: unused.id } }))
              .definitionLocked,
            false,
          );
          await database.query("BEGIN");
          try {
            await database.query(
              "INSERT INTO inventory_items (tenant_id,name,base_unit_id) VALUES ($1,'Rolled back',$2)",
              [a.tenantId, unused.id],
            );
            assert.equal(
              (
                await database.query(
                  "SELECT definition_locked FROM inventory_units WHERE tenant_id = $1 AND id = $2",
                  [a.tenantId, unused.id],
                )
              ).rows[0].definition_locked,
              true,
            );
          } finally {
            await database.query("ROLLBACK");
          }
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: unused.id } }))
              .definitionLocked,
            false,
          );
          for (const table of tables.filter(
            (name) => name !== "inventory_units" && name !== "inventory_unit_conversions",
          )) {
            // All masters, including those without another parent, need a real tenant.
            const extra = table === "inventory_items" ? ",base_unit_id" : "";
            const value = table === "inventory_items" ? ",$2" : "";
            await refused(
              database.query(
                `INSERT INTO "${table}" (tenant_id,name${extra}) VALUES ($1,'Bad'${value})`,
                table === "inventory_items" ? [randomUUID(), unused.id] : [randomUUID()],
              ),
              "23503",
            );
          }
        },
      );

      await t.test(
        "case-preserving keys reject duplicates only in their documented scope, including inactive",
        async () => {
          for (const [sql, values] of [
            [
              "INSERT INTO inventory_units (tenant_id,code,name,precision,dimension) VALUES ($1,'G','Gram',6,'MASS')",
              [a.tenantId],
            ],
            ["INSERT INTO inventory_categories (tenant_id,name) VALUES ($1,'BAHAN')", [a.tenantId]],
            [
              "INSERT INTO inventory_items (tenant_id,name,sku,base_unit_id) VALUES ($1,'Other','kopi-01',$2)",
              [a.tenantId, a.base.id],
            ],
            [
              "INSERT INTO inventory_stock_locations (tenant_id,name) VALUES ($1,'GUDANG')",
              [a.tenantId],
            ],
            [
              "INSERT INTO inventory_stock_locations (tenant_id,outlet_id,name) VALUES ($1,$2,'GUDANG')",
              [a.tenantId, a.outlet.id],
            ],
            [
              "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,1000)",
              [a.tenantId, a.pack.id, a.base.id],
            ],
          ]) {
            await refused(database.query(sql, values), "23505");
          }
          await db.inventoryItem.update({ where: { id: item.id }, data: { status: "INACTIVE" } });
          await refused(
            database.query(
              "INSERT INTO inventory_items (tenant_id,name,sku,base_unit_id) VALUES ($1,'Other','kopi-01',$2)",
              [a.tenantId, a.base.id],
            ),
            "23505",
          );
          await db.inventoryItem.update({ where: { id: item.id }, data: { status: "ACTIVE" } });
          await db.inventoryItem.create({
            data: { tenantId: b.tenantId, name: "Kopi", sku: "kopi-01", baseUnitId: b.base.id },
          });
          await db.inventoryStockLocation.create({
            data: { tenantId: b.tenantId, name: "GUDANG" },
          });
          const secondOutlet = await db.outlet.create({
            data: { tenantId: a.tenantId, brandId: a.brand.id, name: "Cabang", code: "CABANG" },
          });
          await db.inventoryStockLocation.create({
            data: { tenantId: a.tenantId, outletId: secondOutlet.id, name: "GUDANG" },
          });
          await refused(
            database.query(
              "INSERT INTO inventory_unit_conversions (tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$2,1)",
              [a.tenantId, a.base.id],
            ),
          );
        },
      );

      await t.test(
        "blank/padded master facts are refused instead of stored as placeholders",
        async () => {
          for (const code of ["", "1kg", "g g", "<g>", " g", "g "]) {
            await refused(
              database.query(
                "INSERT INTO inventory_units (tenant_id,code,name,precision,dimension) VALUES ($1,$2,'Invalid',0,'MASS')",
                [a.tenantId, code],
              ),
            );
          }
          for (const table of tables.filter((name) => name !== "inventory_unit_conversions")) {
            for (const name of ["", " ", "\t\n", " padded "]) {
              const id = {
                inventory_units: a.base.id,
                inventory_categories: a.category.id,
                inventory_items: item.id,
                inventory_suppliers: supplier.id,
                inventory_stock_locations: storage.id,
              }[table];
              await refused(
                database.query(`UPDATE "${table}" SET name = $1 WHERE tenant_id = $2 AND id = $3`, [
                  name,
                  a.tenantId,
                  id,
                ]),
              );
            }
          }
          for (const value of ["", " ", " padded "]) {
            await refused(
              database.query(
                "UPDATE inventory_items SET sku = $1 WHERE tenant_id = $2 AND id = $3",
                [value, a.tenantId, item.id],
              ),
            );
            await refused(
              database.query(
                "UPDATE inventory_suppliers SET contact = $1 WHERE tenant_id = $2 AND id = $3",
                [value, a.tenantId, supplier.id],
              ),
            );
          }
        },
      );

      await t.test(
        "used definitions and scope cannot move; future-facing labels/status/factor can change",
        async () => {
          for (const mutation of ["precision = 5", "code = 'other'", "definition_locked = FALSE"]) {
            await refused(
              database.query(
                `UPDATE inventory_units SET ${mutation} WHERE tenant_id = $1 AND id = $2`,
                [a.tenantId, a.base.id],
              ),
            );
          }
          await refused(
            database.query(
              "UPDATE inventory_items SET base_unit_id = $1 WHERE tenant_id = $2 AND id = $3",
              [a.pack.id, a.tenantId, item.id],
            ),
          );
          await refused(
            database.query(
              "UPDATE inventory_unit_conversions SET from_unit_id = $1 WHERE tenant_id = $2 AND id = $3",
              [a.base.id, a.tenantId, conversion.id],
            ),
          );
          await refused(
            database.query(
              "UPDATE inventory_unit_conversions SET to_unit_id = $1 WHERE tenant_id = $2 AND id = $3",
              [a.pack.id, a.tenantId, conversion.id],
            ),
          );
          await refused(
            database.query(
              "UPDATE inventory_stock_locations SET outlet_id = $1 WHERE tenant_id = $2 AND id = $3",
              [a.outlet.id, a.tenantId, storage.id],
            ),
          );
          await refused(
            database.query(
              "UPDATE inventory_stock_locations SET outlet_id = NULL WHERE tenant_id = $1 AND id = $2",
              [a.tenantId, outletStorage.id],
            ),
          );
          await db.inventoryUnit.update({ where: { id: a.base.id }, data: { name: "Gram" } });
          await db.inventoryUnitConversion.update({
            where: { id: conversion.id },
            data: { factor: "1000" },
          });
          assert.equal(
            (
              await db.inventoryUnitConversion.findUniqueOrThrow({ where: { id: conversion.id } })
            ).factor.toString(),
            "1000",
          );
          for (const delegate of [
            db.inventoryCategory,
            db.inventoryItem,
            db.inventorySupplier,
            db.inventoryStockLocation,
          ]) {
            const row = await delegate.findFirstOrThrow({ where: { tenantId: a.tenantId } });
            await delegate.update({ where: { id: row.id }, data: { status: "INACTIVE" } });
            await delegate.update({ where: { id: row.id }, data: { status: "ACTIVE" } });
          }
        },
      );

      await t.test("skipped inserts and upsert candidates never latch unused units", async () => {
        const candidate = await unit(db, a.tenantId, "candidate", 3);
        const secondCandidate = await unit(db, a.tenantId, "candidate_to", 3);
        const skipped = await database.query(
          "INSERT INTO inventory_items (tenant_id,name,sku,base_unit_id) VALUES ($1,'Candidate','KOPI-01',$2) ON CONFLICT DO NOTHING",
          [a.tenantId, candidate.id],
        );
        assert.equal(skipped.rowCount, 0);
        await database.query(
          "INSERT INTO inventory_items (id,tenant_id,name,base_unit_id) VALUES ($1,$2,'Candidate',$3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
          [item.id, a.tenantId, candidate.id],
        );
        const skippedConversion = await database.query(
          "INSERT INTO inventory_unit_conversions (id,tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,$4,2) ON CONFLICT DO NOTHING",
          [conversion.id, a.tenantId, candidate.id, secondCandidate.id],
        );
        assert.equal(skippedConversion.rowCount, 0);
        await database.query(
          "INSERT INTO inventory_unit_conversions (id,tenant_id,from_unit_id,to_unit_id,factor) VALUES ($1,$2,$3,$4,2) ON CONFLICT (id) DO UPDATE SET factor = EXCLUDED.factor",
          [conversion.id, a.tenantId, candidate.id, secondCandidate.id],
        );
        for (const id of [candidate.id, secondCandidate.id]) {
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id } })).definitionLocked,
            false,
          );
          await db.inventoryUnit.update({ where: { id }, data: { precision: 0 } });
        }
        assert.equal(
          (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).baseUnitId,
          a.base.id,
        );
        const actualConversion = await db.inventoryUnitConversion.findUniqueOrThrow({
          where: { id: conversion.id },
        });
        assert.equal(actualConversion.fromUnitId, a.pack.id);
        assert.equal(actualConversion.toUnitId, a.base.id);
      });

      await t.test(
        "every master retains identity and rows even on DELETE or TRUNCATE CASCADE",
        async () => {
          for (const table of tables) {
            const row = (
              await database.query(`SELECT id FROM "${table}" WHERE tenant_id = $1 LIMIT 1`, [
                a.tenantId,
              ])
            ).rows[0];
            await refused(
              database.query(
                `UPDATE "${table}" SET tenant_id = $1 WHERE tenant_id = $2 AND id = $3`,
                [b.tenantId, a.tenantId, row.id],
              ),
            );
            await refused(
              database.query(`UPDATE "${table}" SET id = $1 WHERE tenant_id = $2 AND id = $3`, [
                randomUUID(),
                a.tenantId,
                row.id,
              ]),
            );
            await refused(
              database.query(`DELETE FROM "${table}" WHERE tenant_id = $1 AND id = $2`, [
                a.tenantId,
                row.id,
              ]),
            );
            await refused(database.query(`TRUNCATE "${table}" CASCADE`));
            assert.equal(
              (
                await database.query(`SELECT id FROM "${table}" WHERE tenant_id = $1 AND id = $2`, [
                  a.tenantId,
                  row.id,
                ])
              ).rowCount,
              1,
            );
          }
        },
      );

      await t.test(
        "first-reference latch serializes both writer orders under read committed and repeatable read",
        async () => {
          for (const isolation of ["READ COMMITTED", "REPEATABLE READ"]) {
            for (const referenceFirst of [true, false]) {
              const target = await unit(
                db,
                a.tenantId,
                `race_${isolation === "READ COMMITTED" ? "rc" : "rr"}_${referenceFirst ? "ref" : "def"}`,
                3,
              );
              const definition = createClient();
              const reference = createClient();
              try {
                await Promise.all([definition.connect(), reference.connect()]);
                for (const client of [definition, reference]) {
                  await client.query("SET lock_timeout = '10s'");
                  await client.query("SET statement_timeout = '15s'");
                  await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
                  await client.query(
                    "SELECT precision FROM inventory_units WHERE tenant_id = $1 AND id = $2",
                    [a.tenantId, target.id],
                  );
                }
                const edit = () =>
                  definition.query(
                    "UPDATE inventory_units SET precision = 0 WHERE tenant_id = $1 AND id = $2",
                    [a.tenantId, target.id],
                  );
                const insert = () =>
                  reference.query(
                    "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Race',$2,0.001)",
                    [a.tenantId, target.id],
                  );
                const first = referenceFirst ? reference : definition;
                const second = referenceFirst ? definition : reference;
                await (referenceFirst ? insert() : edit());
                // Attach the rejection handler before unblocking the writer.
                const pending = (referenceFirst ? edit() : insert()).then(
                  () => ({ code: "unexpected-success" }),
                  (error) => error,
                );
                await waitForBlocked(database, second.processID);
                await first.query("COMMIT");
                const error = await pending;
                assert.equal(error.code, isolation === "REPEATABLE READ" ? "40001" : "23514");
                await second.query("ROLLBACK");
                const finalUnit = await db.inventoryUnit.findUniqueOrThrow({
                  where: { id: target.id },
                });
                assert.equal(finalUnit.precision, referenceFirst ? 3 : 0);
                assert.equal(finalUnit.definitionLocked, referenceFirst);
                assert.equal(
                  await db.inventoryItem.count({
                    where: { tenantId: a.tenantId, baseUnitId: target.id },
                  }),
                  referenceFirst ? 1 : 0,
                );
              } finally {
                // Release both sides together even if an assertion fails while one is blocked.
                await Promise.allSettled([
                  definition.query("ROLLBACK"),
                  reference.query("ROLLBACK"),
                ]);
                await Promise.all([definition.end(), reference.end()]);
              }
            }
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
