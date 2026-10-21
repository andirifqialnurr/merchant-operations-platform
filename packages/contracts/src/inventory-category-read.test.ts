import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  inventoryCategoryListQuerySchema,
  inventoryCategoryPageSchema,
  inventoryCategorySchema,
  inventoryRecordStatusSchema,
} from "./inventory.ts";

const category = { id: randomUUID(), name: "Bahan", status: "ACTIVE" };

test("Inventory category query is bounded keyset pagination with explicit optional exact status", () => {
  assert.deepEqual(inventoryCategoryListQuerySchema.parse({}), { limit: 25 });
  for (const status of ["ACTIVE", "INACTIVE"]) {
    assert.equal(inventoryRecordStatusSchema.parse(status), status);
    assert.deepEqual(
      inventoryCategoryListQuerySchema.parse({ status, cursor: category.id, limit: "100" }),
      { status, cursor: category.id, limit: 100 },
    );
  }
  for (const limit of [0, -1, 101, 1.5, "01", "1e2", "", null])
    assert.equal(inventoryCategoryListQuerySchema.safeParse({ limit }).success, false);
  for (const status of ["active", "ALL", "ARCHIVED", "", null, ["ACTIVE"]])
    assert.equal(inventoryCategoryListQuerySchema.safeParse({ status }).success, false);
  assert.equal(inventoryCategoryListQuerySchema.safeParse({ cursor: "not-a-uuid" }).success, false);
});

test("category query never accepts master mutations, lookup/count, scope or financial fields", () => {
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "name",
    "search",
    "includeItems",
    "itemCount",
    "actorId",
    "updatedAt",
    "balance",
    "costMinor",
    "factor",
  ])
    assert.equal(
      inventoryCategoryListQuerySchema.safeParse({ [field]: "1" }).success,
      false,
      field,
    );
});

test("category read DTO owns only id/name/status and refuses hidden/financial metadata", () => {
  assert.deepEqual(inventoryCategorySchema.parse(category), category);
  assert.equal(inventoryCategorySchema.safeParse({ ...category, name: " " }).success, false);
  assert.equal(
    inventoryCategorySchema.safeParse({ ...category, name: "x".repeat(161) }).success,
    false,
  );
  assert.equal(
    inventoryCategorySchema.safeParse({ ...category, status: "ARCHIVED" }).success,
    false,
  );
  for (const field of [
    "tenantId",
    "outletId",
    "createdAt",
    "updatedAt",
    "actorId",
    "items",
    "itemCount",
    "balance",
    "costMinor",
    "contact",
  ])
    assert.equal(
      inventoryCategorySchema.safeParse({ ...category, [field]: "1" }).success,
      false,
      field,
    );
});

test("category page has no fake totals and its next cursor must match the visible bounded end", () => {
  const empty = { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
  assert.deepEqual(inventoryCategoryPageSchema.parse(empty), empty);
  const page = { items: [category], pageInfo: { hasNextPage: true, nextCursor: category.id } };
  assert.deepEqual(inventoryCategoryPageSchema.parse(page), page);
  for (const invalid of [
    { ...empty, total: 0 },
    { ...page, pageInfo: { hasNextPage: true, nextCursor: randomUUID() } },
    { ...empty, pageInfo: { hasNextPage: false, nextCursor: category.id } },
    { ...empty, pageInfo: { hasNextPage: true, nextCursor: category.id } },
    { ...empty, items: Array.from({ length: 101 }, () => category) },
  ])
    assert.equal(inventoryCategoryPageSchema.safeParse(invalid).success, false);
});
