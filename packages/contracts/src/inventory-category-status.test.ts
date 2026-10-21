import assert from "node:assert/strict";
import test from "node:test";

import {
  createInventoryCategorySchema,
  setInventoryCategoryStatusSchema,
  updateInventoryCategorySchema,
} from "./inventory.ts";

test("category lifecycle accepts only an explicit ACTIVE/INACTIVE target on its dedicated contract", () => {
  for (const status of ["ACTIVE", "INACTIVE"])
    assert.deepEqual(setInventoryCategoryStatusSchema.parse({ status }), { status });
  for (const input of [
    {},
    { status: undefined },
    { status: null },
    { status: "active" },
    { status: "ARCHIVED" },
    { status: true },
    { status: ["ACTIVE"] },
    { status: "" },
  ])
    assert.equal(setInventoryCategoryStatusSchema.safeParse(input).success, false);
});

test("category lifecycle cannot rename, reassign items, change scope or submit audit/derived metadata", () => {
  for (const field of [
    "name",
    "id",
    "tenantId",
    "outletId",
    "actorId",
    "parentId",
    "items",
    "itemStatus",
    "itemCount",
    "reason",
    "updatedAt",
    "createdAt",
    "expectedVersion",
    "balance",
    "costMinor",
  ])
    for (const value of ["1", undefined])
      assert.equal(
        setInventoryCategoryStatusSchema.safeParse({ status: "ACTIVE", [field]: value }).success,
        false,
        field,
      );
});

test("create and rename still do not own category lifecycle even when the submitted status is ACTIVE", () => {
  for (const schema of [createInventoryCategorySchema, updateInventoryCategorySchema])
    for (const status of ["ACTIVE", "INACTIVE", undefined])
      assert.equal(schema.safeParse({ name: "Bahan", status }).success, false);
});
