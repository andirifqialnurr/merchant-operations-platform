import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { updateInventoryItemSchema } from "./inventory.ts";

test("item patch has no create defaults: omission preserves and NULL clears only nullable fields", () => {
  assert.deepEqual(updateInventoryItemSchema.parse({ name: " New " }), { name: "New" });
  assert.deepEqual(
    updateInventoryItemSchema.parse({ sku: null, categoryId: null, minStock: null }),
    { sku: null, categoryId: null, minStock: null },
  );
  assert.deepEqual(
    updateInventoryItemSchema.parse({ sku: " NEW ", categoryId: randomUUID(), minStock: "0" }).sku,
    "NEW",
  );
  for (const input of [{}, { sku: undefined }, { minStock: undefined }, { name: null }])
    assert.equal(updateInventoryItemSchema.safeParse(input).success, false);
});
test("item edit never accepts status/base-unit/identity/stock/finance/scope/relation/quota mutations", () => {
  for (const key of [
    "status",
    "baseUnitId",
    "id",
    "tenantId",
    "actorId",
    "createdAt",
    "outletId",
    "balance",
    "openingStock",
    "cost",
    "hpp",
    "category",
    "definitionLocked",
    "activeCount",
    "unlimited",
  ])
    assert.equal(
      updateInventoryItemSchema.safeParse({ name: "Edit", [key]: "forbidden" }).success,
      false,
    );
});
test("item patch syntax keeps exact minimum bounds and rejects blanks/numbers/invalid UUID", () => {
  for (const input of [
    { name: " " },
    { sku: "" },
    { sku: "a".repeat(65) },
    { categoryId: "bad" },
    { minStock: 0 },
    { minStock: "-0" },
    { minStock: "-1" },
    { minStock: "1e-6" },
    { minStock: "0.0000001" },
    { minStock: "1000000000000000000000000" },
  ])
    assert.equal(updateInventoryItemSchema.safeParse(input).success, false);
  for (const minStock of [null, "0", "1.000000", "0.000001", "999999999999999999999999.999999"])
    assert.equal(updateInventoryItemSchema.safeParse({ minStock }).success, true);
});
