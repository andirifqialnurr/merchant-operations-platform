import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20261021030000_inventory_conversion_compatibility/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("conversion compatibility migration replaces only the guard, preserving legacy rows/grants/replay", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION "inventory_conversion_units_guard"/);
  assert.doesNotMatch(
    sql,
    /\b(?:INSERT\s+INTO|UPDATE\s+inventory_|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b/i,
  );
  assert.doesNotMatch(sql, /role_permissions|idempotency_keys|core_effective_entitlements/);
});

test("conversion guard locks scoped parents in UUID order and refuses unknown/different dimensions", () => {
  assert.match(sql, /WHERE tenant_id = NEW\.tenant_id/);
  assert.match(sql, /ORDER BY id FOR NO KEY UPDATE/);
  assert.match(sql, /parent\.dimension IS NULL/);
  assert.match(sql, /parent\.dimension IS DISTINCT FROM first_dimension/);
  assert.match(sql, /parent_count = 2 AND NOT compatible/);
  assert.match(sql, /inventory_unit_conversions_dimensions_check/);
});

test("conversion command error codes have id/en dictionary coverage before future HTTP wiring", () => {
  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(
      readFileSync(new URL(`../../web/messages/${locale}.json`, import.meta.url), "utf8"),
    ) as { errors: Record<string, string> };
    for (const code of [
      "INVENTORY_UNIT_NOT_FOUND",
      "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
      "INVENTORY_CONVERSION_PAIR_TAKEN",
    ])
      assert.ok(errors[code]);
  }
});
