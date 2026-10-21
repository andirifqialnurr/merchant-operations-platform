import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  inventoryItemSchema,
  inventoryItemListQuerySchema,
  inventoryItemPageSchema,
} from "./inventory.ts";

const row = {
  id: randomUUID(),
  sku: null,
  name: "Flour",
  categoryId: null,
  baseUnitId: randomUUID(),
  minStock: null,
  status: "ACTIVE",
};

test("item master requires nullable facts explicitly and exact nonnegative threshold strings", () => {
  assert.deepEqual(inventoryItemSchema.parse(row), row);
  for (const minStock of [null, "0", "0.000001", "999999999999999999999999.999999"])
    assert.equal(inventoryItemSchema.parse({ ...row, minStock }).minStock, minStock);
  for (const minStock of [
    undefined,
    0,
    -1,
    "-0",
    "-1",
    "1e-6",
    "0.0000001",
    "1000000000000000000000000",
    "",
  ])
    assert.equal(inventoryItemSchema.safeParse({ ...row, minStock }).success, false);
  for (const key of ["sku", "categoryId", "minStock"])
    assert.equal(
      inventoryItemSchema.safeParse(
        Object.fromEntries(Object.entries(row).filter(([field]) => field !== key)),
      ).success,
      false,
    );
});

test("item master excludes financial, ORM, stock and parent context fields", () => {
  for (const key of [
    "cost",
    "hpp",
    "margin",
    "price",
    "balance",
    "lowStock",
    "tenantId",
    "createdAt",
    "baseUnit",
    "category",
    "definitionReferenced",
  ])
    assert.equal(inventoryItemSchema.safeParse({ ...row, [key]: "secret" }).success, false);
  for (const patch of [
    { sku: "" },
    { name: "" },
    { status: "ARCHIVED" },
    { baseUnitId: null },
    { categoryId: "invalid" },
  ])
    assert.equal(inventoryItemSchema.safeParse({ ...row, ...patch }).success, false);
});

test("item query accepts bounded exact filters, never scope, finance or mutation inputs", () => {
  assert.deepEqual(inventoryItemListQuerySchema.parse({}), { limit: 25 });
  const input = {
    limit: "100",
    cursor: randomUUID(),
    categoryId: randomUUID(),
    baseUnitId: randomUUID(),
    status: "INACTIVE",
  };
  assert.deepEqual(inventoryItemListQuerySchema.parse(input), { ...input, limit: 100 });
  for (const patch of [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: "01" },
    { limit: true },
    { status: "active" },
    { cursor: "bad" },
    { categoryId: null },
    { baseUnitId: "bad" },
    { tenantId: randomUUID() },
    { outletId: randomUUID() },
    { cost: "0" },
    { name: "New" },
    { minStock: "0" },
  ])
    assert.equal(inventoryItemListQuerySchema.safeParse(patch).success, false);
});

test("item page requires bounded strict coherent cursor metadata and rejects counts/leaks", () => {
  const page = { items: [row], pageInfo: { hasNextPage: true, nextCursor: row.id } };
  assert.equal(inventoryItemPageSchema.safeParse(page).success, true);
  for (const invalid of [
    { ...page, total: 1 },
    { ...page, items: Array(101).fill(row) },
    { ...page, pageInfo: { hasNextPage: false, nextCursor: row.id } },
    { ...page, pageInfo: { hasNextPage: true, nextCursor: randomUUID() } },
    { ...page, items: [{ ...row, cost: "0" }] },
  ])
    assert.equal(inventoryItemPageSchema.safeParse(invalid).success, false);
});
