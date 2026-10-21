import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryCategorySchema } from "./inventory.ts";

test("category create owns one trimmed case-preserving name, not a generated code/slug/status", () => {
  assert.deepEqual(createInventoryCategorySchema.parse({ name: " Bahan Kering " }), {
    name: "Bahan Kering",
  });
  for (const name of ["Bahan", "BAHAN", "Bahan dapur", "Minuman & bahan", "x".repeat(160)])
    assert.deepEqual(createInventoryCategorySchema.parse({ name }), { name });
});

test("category create refuses blank, missing, overlong, null or non-string name values", () => {
  for (const name of [undefined, null, "", " \t\n ", "x".repeat(161), 0, {}, ["Bahan"]])
    assert.equal(createInventoryCategorySchema.safeParse({ name }).success, false);
  assert.equal(createInventoryCategorySchema.safeParse({}).success, false);
});

test("category create never accepts identity, lifecycle, scope/audit, hierarchy, relations or derived data", () => {
  for (const field of [
    "id",
    "status",
    "tenantId",
    "outletId",
    "actorId",
    "createdAt",
    "updatedAt",
    "reason",
    "idempotencyKey",
    "parentId",
    "code",
    "slug",
    "items",
    "itemCount",
    "balance",
    "costMinor",
    "contact",
  ])
    for (const value of ["1", undefined])
      assert.equal(
        createInventoryCategorySchema.safeParse({ name: "Bahan", [field]: value }).success,
        false,
        field,
      );
});
