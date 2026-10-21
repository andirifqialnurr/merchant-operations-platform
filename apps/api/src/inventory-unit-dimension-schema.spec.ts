import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20261021020000_inventory_unit_dimension/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
  "utf8",
);

test("dimension storage preserves unknown legacy facts without default, data rewrite or activation", () => {
  assert.match(schema, /dimension\s+InventoryUnitDimension\?/);
  assert.match(migration, /ADD COLUMN "dimension" "InventoryUnitDimension";/);
  assert.doesNotMatch(
    migration,
    /\b(?:SET\s+DEFAULT|UPDATE\s+inventory_units\s+SET|INSERT\s+INTO|DELETE\s+FROM)\b/i,
  );
  assert.doesNotMatch(
    migration,
    /core_effective_entitlements|role_permissions|module_installations|idempotency_keys/,
  );
});

test("new definitions require dimension; known or referenced classifications are immutable", () => {
  assert.match(migration, /TG_OP = 'INSERT'[\s\S]*NEW\.dimension IS NULL/);
  assert.match(
    migration,
    /NEW\.dimension IS DISTINCT FROM OLD\.dimension[\s\S]*OLD\.dimension IS NOT NULL OR OLD\.definition_locked/,
  );
  assert.match(migration, /BEFORE INSERT OR UPDATE ON "inventory_units"/);
  assert.match(migration, /inventory_units_dimension_required_check/);
  assert.match(migration, /inventory_units_dimension_immutable_check/);
});
