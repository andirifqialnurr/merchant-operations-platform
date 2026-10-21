import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createInventoryItemSchema } from "./inventory.ts";

const basic = { name: " Flour ", baseUnitId: randomUUID() };
test("item creation owns name/unit and optional nullable master values, never initial status", () => {
  assert.deepEqual(createInventoryItemSchema.parse(basic), {
    ...basic,
    name: "Flour",
    sku: null,
    categoryId: null,
    minStock: null,
  });
  const input = { ...basic, sku: " FL-1 ", categoryId: randomUUID(), minStock: "0" };
  assert.deepEqual(createInventoryItemSchema.parse(input), {
    ...input,
    name: "Flour",
    sku: "FL-1",
  });
});
test("item creation refuses mutation metadata, stock, finance and limit bypass fields", () => {
  for (const key of [
    "status",
    "id",
    "tenantId",
    "actorId",
    "outletId",
    "createdAt",
    "definitionLocked",
    "balance",
    "openingStock",
    "cost",
    "hpp",
    "activeCount",
    "unlimited",
    "category",
    "baseUnit",
  ])
    assert.equal(createInventoryItemSchema.safeParse({ ...basic, [key]: "fake" }).success, false);
});
test("item create syntax requires unit and exact nonnegative minimum without fake blanks", () => {
  for (const patch of [
    { baseUnitId: undefined },
    { baseUnitId: "bad" },
    { categoryId: "bad" },
    { name: " " },
    { sku: "" },
    { sku: "a".repeat(65) },
    { minStock: 0 },
    { minStock: "-0" },
    { minStock: "1e-6" },
    { minStock: "0.0000001" },
    { minStock: "1000000000000000000000000" },
  ])
    assert.equal(createInventoryItemSchema.safeParse({ ...basic, ...patch }).success, false);
  for (const minStock of [null, "0", "0.000001", "1.000000", "999999999999999999999999.999999"])
    assert.equal(createInventoryItemSchema.safeParse({ ...basic, minStock }).success, true);
});
