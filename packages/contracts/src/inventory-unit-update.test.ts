import assert from "node:assert/strict";
import test from "node:test";

import { updateInventoryUnitSchema } from "./inventory.ts";

test("unit update accepts only a nonempty partial code/name/precision patch and trims owned strings", () => {
  for (const [input, expected] of [
    [{ name: " Gram " }, { name: "Gram" }],
    [{ code: " g " }, { code: "g" }],
    [{ precision: 0 }, { precision: 0 }],
    [
      { code: "kg", name: "Kilogram", precision: 6 },
      { code: "kg", name: "Kilogram", precision: 6 },
    ],
  ])
    assert.deepEqual(updateInventoryUnitSchema.parse(input), expected);
  for (const input of [
    {},
    { code: undefined },
    { precision: undefined, name: undefined },
    null,
    [],
    "g",
  ])
    assert.equal(updateInventoryUnitSchema.safeParse(input).success, false);
});

test("unit update retains create validation without accepting implicit resets, coercion or blank labels", () => {
  for (const input of [
    { code: null },
    { name: null },
    { precision: null },
    { name: " " },
    { code: "1kg" },
    { code: "g g" },
    { name: "x".repeat(161) },
    { precision: -1 },
    { precision: 7 },
    { precision: 1.5 },
    { precision: "6" },
  ])
    assert.equal(updateInventoryUnitSchema.safeParse(input).success, false);
  assert.deepEqual(updateInventoryUnitSchema.parse({ name: "Gram" }), { name: "Gram" });
});

test("unit update never owns identity, dimension, reference latch, lifecycle, audit, scope or derived values", () => {
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "actorId",
    "dimension",
    "definitionLocked",
    "status",
    "createdAt",
    "updatedAt",
    "expectedVersion",
    "reason",
    "balance",
    "minStock",
    "quantity",
    "factor",
    "unitCostMinor",
  ])
    for (const value of ["1", undefined])
      assert.equal(
        updateInventoryUnitSchema.safeParse({ name: "Gram", [field]: value }).success,
        false,
        field,
      );
});
