import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
  "utf8",
);
const sql = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20261020010000_inventory_masters/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const masters = [
  ["InventoryUnit", "inventory_units"],
  ["InventoryUnitConversion", "inventory_unit_conversions"],
  ["InventoryCategory", "inventory_categories"],
  ["InventoryItem", "inventory_items"],
  ["InventorySupplier", "inventory_suppliers"],
  ["InventoryStockLocation", "inventory_stock_locations"],
] as const;

function model(name: string) {
  const result = schema.match(new RegExp(`model ${name} \\{([^}]+)\\}`))?.[1];
  assert.ok(result, name);
  return result.replace(/^\s*\/\/.*$/gm, "");
}

test("Inventory master ownership and composite references do not require Catalog/POS/KDS", () => {
  assert.equal(sql.match(/CREATE TABLE /g)?.length, 6);
  for (const [name, table] of masters) {
    const body = model(name);
    assert.match(body, /tenantId\s+String\s+@map\("tenant_id"\) @db.Uuid/);
    assert.match(body, /@@unique\(\[tenantId, id\]\)/);
    assert.match(body, new RegExp(`@@map\\("${table}"\\)`));
    assert.doesNotMatch(body, /Catalog|Order|Kds|Pos|balance|costMinor|openingStock/);
    assert.match(sql, new RegExp(`"${table}_tenant_id_fkey" FOREIGN KEY \\("tenant_id"\\)`));
  }
  for (const [parent, field] of [
    ["inventory_units", "from_unit_id"],
    ["inventory_units", "to_unit_id"],
    ["inventory_units", "base_unit_id"],
    ["inventory_categories", "category_id"],
    ["outlets", "outlet_id"],
  ]) {
    assert.ok(
      sql.includes(
        `FOREIGN KEY ("tenant_id", "${field}")\n    REFERENCES "${parent}"("tenant_id", "id") ON DELETE RESTRICT`,
      ),
    );
  }
  assert.doesNotMatch(sql, /INSERT INTO|ALTER TABLE|CREATE TABLE "inventory_(movements|balance)/);
});

test("Inventory numeric storage refuses excess scale instead of coercing numeric(p,s)", () => {
  assert.match(model("InventoryItem"), /minStock\s+Decimal\?\s+@map\("min_stock"\) @db.Decimal\s/);
  assert.match(model("InventoryUnitConversion"), /factor\s+Decimal\s+@db.Decimal\s/);
  assert.match(sql, /"min_stock" NUMERIC,/);
  assert.match(sql, /"factor" NUMERIC NOT NULL/);
  assert.match(sql, /scale\("min_stock"\) <= 6/);
  assert.match(sql, /scale\("factor"\) <= 12/);
  assert.match(sql, /"min_stock" >= 0 AND "min_stock" < 1000000000000000000000000/);
  assert.match(sql, /"factor" > 0 AND "factor" < 1000000000000000000/);
  assert.match(sql, /trunc\(NEW.min_stock, unit_precision\) <> NEW.min_stock/);
  assert.doesNotMatch(sql, /"(?:min_stock|factor)" NUMERIC\s*\(/);
  assert.doesNotMatch(sql, /"min_stock"[^\n]*DEFAULT/);
});

test("Inventory definitions latch through parent row writes, never stale snapshot EXISTS checks", () => {
  assert.match(model("InventoryUnit"), /definitionLocked\s+Boolean\s+@default\(false\)/);
  assert.equal(sql.match(/UPDATE inventory_units SET definition_locked = TRUE/g)?.length, 1);
  assert.match(sql, /IF OLD.definition_locked AND/);
  assert.match(sql, /NOT NEW.definition_locked OR NEW.code IS DISTINCT FROM OLD.code/);
  assert.match(sql, /NEW.precision IS DISTINCT FROM OLD.precision/);
  assert.match(sql, /ORDER BY id FOR NO KEY UPDATE/);
  assert.match(sql, /id = NEW.base_unit_id FOR NO KEY UPDATE/);
  for (const table of ["inventory_items", "inventory_unit_conversions"]) {
    assert.ok(sql.includes(`BEFORE INSERT OR UPDATE ON "${table}"`));
    assert.ok(sql.includes(`AFTER INSERT OR UPDATE ON "${table}"`));
  }
});

test("Inventory master retention covers identity, definition bindings and truncate as well as delete", () => {
  for (const [, table] of masters) {
    assert.ok(sql.includes(`BEFORE UPDATE OR DELETE ON "${table}"`));
    assert.ok(sql.includes(`BEFORE TRUNCATE ON "${table}"`));
  }
  assert.match(sql, /TG_OP IN \('DELETE', 'TRUNCATE'\)/);
  for (const field of [
    "id",
    "tenant_id",
    "base_unit_id",
    "from_unit_id",
    "to_unit_id",
    "outlet_id",
  ]) {
    assert.ok(sql.includes(`NEW.${field} IS DISTINCT FROM OLD.${field}`), field);
  }
});

test("Inventory uniqueness includes workspace, casing and the distinct NULL storage scope", () => {
  for (const [table, field] of [
    ["inventory_units", "code"],
    ["inventory_categories", "name"],
    ["inventory_items", "sku"],
  ]) {
    assert.ok(sql.includes(`ON "${table}"("tenant_id", lower("${field}"))`));
  }
  assert.match(sql, /"tenant_id", "outlet_id", lower\("name"\)\) WHERE "outlet_id" IS NOT NULL/);
  assert.match(sql, /"tenant_id", lower\("name"\)\) WHERE "outlet_id" IS NULL/);
  assert.match(sql, /"tenant_id", "from_unit_id", "to_unit_id"\)/);
  assert.match(sql, /"from_unit_id" <> "to_unit_id"/);
  assert.match(model("InventoryStockLocation"), /outletId\s+String\?/);
  assert.doesNotMatch(sql, /CREATE UNIQUE INDEX[^\n]*suppliers[^\n]*name/);
});
