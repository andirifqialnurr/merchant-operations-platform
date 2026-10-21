import assert from "node:assert/strict";
import test from "node:test";

import { updateInventoryCategorySchema } from "./inventory.ts";

test("category rename requires one trimmed case-preserving name with the existing bounds", () => {
  for (const [input, expected] of [
    [" Bahan ", "Bahan"],
    ["BAHAN", "BAHAN"],
    ["Bahan & minuman", "Bahan & minuman"],
    ["x".repeat(160), "x".repeat(160)],
  ])
    assert.deepEqual(updateInventoryCategorySchema.parse({ name: input }), { name: expected });
  assert.equal(updateInventoryCategorySchema.safeParse({}).success, false);
});

test("category rename refuses blank/missing/null/non-string/overlong values without implicit reset", () => {
  for (const name of [undefined, null, "", " \t\n ", 0, [], {}, "x".repeat(161)])
    assert.equal(updateInventoryCategorySchema.safeParse({ name }).success, false);
});

test("category rename never owns status, identity, scope, relations, hierarchy, audit or derived values", () => {
  for (const field of [
    "id",
    "status",
    "tenantId",
    "outletId",
    "actorId",
    "createdAt",
    "updatedAt",
    "expectedVersion",
    "reason",
    "parentId",
    "items",
    "itemCount",
    "slug",
    "balance",
    "costMinor",
  ])
    for (const value of ["1", undefined])
      assert.equal(
        updateInventoryCategorySchema.safeParse({ name: "Bahan", [field]: value }).success,
        false,
        field,
      );
});
