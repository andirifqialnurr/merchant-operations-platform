import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  inventoryUnitConversionListQuerySchema,
  inventoryUnitConversionPageSchema,
  inventoryUnitConversionSchema,
  inventoryUnitListQuerySchema,
  inventoryUnitPageSchema,
} from "./inventory.ts";

const unit = { id: randomUUID(), code: "g", name: "Gram", precision: 6, dimension: "MASS" };
const conversion = {
  id: randomUUID(),
  fromUnitId: randomUUID(),
  toUnitId: unit.id,
  factor: "0.000000000001",
};

test("Inventory master queries accept bounded keyset pagination, not scope/metadata or coercion surprises", () => {
  assert.deepEqual(inventoryUnitListQuerySchema.parse({}), { limit: 25 });
  assert.deepEqual(inventoryUnitListQuerySchema.parse({ limit: "100", cursor: unit.id }), {
    limit: 100,
    cursor: unit.id,
  });
  for (const limit of [
    0,
    -1,
    101,
    1.5,
    Infinity,
    NaN,
    true,
    false,
    null,
    [],
    [1],
    {},
    "",
    "1e2",
    "1.0",
    "001",
    " 1",
    "101",
  ]) {
    assert.equal(inventoryUnitListQuerySchema.safeParse({ limit }).success, false, String(limit));
  }
  for (const field of [
    "tenantId",
    "outletId",
    "userId",
    "actorId",
    "status",
    "balance",
    "definitionLocked",
    "q",
    "fromUnitId",
  ]) {
    assert.equal(inventoryUnitListQuerySchema.safeParse({ [field]: unit.id }).success, false);
  }
  assert.equal(inventoryUnitListQuerySchema.safeParse({ cursor: "not-a-uuid" }).success, false);
});

test("conversion filters are exact optional unit IDs, never factor/result/path inputs", () => {
  const query = { fromUnitId: conversion.fromUnitId, toUnitId: unit.id };
  assert.deepEqual(inventoryUnitConversionListQuerySchema.parse(query), { ...query, limit: 25 });
  assert.equal(
    inventoryUnitConversionListQuerySchema.safeParse({ fromUnitId: "g" }).success,
    false,
  );
  for (const field of ["factor", "quantity", "convertedQuantity", "tenantId", "outletId", "path"]) {
    assert.equal(inventoryUnitConversionListQuerySchema.safeParse({ [field]: "1" }).success, false);
  }
});

test("conversion read DTO retains exact string factor and hides system/financial fields", () => {
  assert.deepEqual(inventoryUnitConversionSchema.parse(conversion), conversion);
  for (const factor of [1, "1e-12", "0", "-1", "0.0000000000001"]) {
    assert.equal(inventoryUnitConversionSchema.safeParse({ ...conversion, factor }).success, false);
  }
  for (const field of [
    "tenantId",
    "createdAt",
    "updatedAt",
    "definitionLocked",
    "balance",
    "unitCostMinor",
    "convertedQuantity",
  ]) {
    assert.equal(
      inventoryUnitConversionSchema.safeParse({ ...conversion, [field]: "1" }).success,
      false,
    );
  }
  assert.equal(
    inventoryUnitConversionSchema.safeParse({ ...conversion, fromUnitId: unit.id.toUpperCase() })
      .success,
    false,
  );
});

test("master pages contain only bounded facts and consistent derived cursor metadata", () => {
  const last = { items: [unit], pageInfo: { hasNextPage: false, nextCursor: null } };
  assert.deepEqual(inventoryUnitPageSchema.parse(last), last);
  assert.equal(inventoryUnitPageSchema.safeParse({ ...last, total: 0 }).success, false);
  assert.equal(
    inventoryUnitPageSchema.safeParse({ ...last, items: Array.from({ length: 101 }, () => unit) })
      .success,
    false,
  );
  for (const pageInfo of [
    { hasNextPage: true, nextCursor: null },
    { hasNextPage: false, nextCursor: unit.id },
    { hasNextPage: true, nextCursor: randomUUID() },
    { hasNextPage: false, nextCursor: null, total: 0 },
  ])
    assert.equal(inventoryUnitPageSchema.safeParse({ ...last, pageInfo }).success, false);
  assert.equal(
    inventoryUnitPageSchema.safeParse({
      items: [],
      pageInfo: { hasNextPage: true, nextCursor: unit.id },
    }).success,
    false,
  );
  const page = { items: [conversion], pageInfo: { hasNextPage: true, nextCursor: conversion.id } };
  assert.deepEqual(inventoryUnitConversionPageSchema.parse(page), page);
});
