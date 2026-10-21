import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createInventoryUnitSchema,
  inventoryUnitDimensionSchema,
  inventoryUnitSchema,
} from "./inventory.ts";

const body = { code: "g", name: "Gram", precision: 6 };

test("unit dimension is explicit, closed and not inferred from code or precision", () => {
  for (const dimension of ["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"]) {
    assert.equal(inventoryUnitDimensionSchema.parse(dimension), dimension);
    assert.deepEqual(createInventoryUnitSchema.parse({ ...body, dimension }), {
      ...body,
      dimension,
    });
  }
  for (const dimension of [null, undefined, "", "mass", "OTHER", "kg", 0, {}, ["MASS"]])
    assert.equal(createInventoryUnitSchema.safeParse({ ...body, dimension }).success, false);
  assert.equal(createInventoryUnitSchema.safeParse(body).success, false);
});

test("legacy read dimensions are explicitly null, never omitted, invented or accepted for create", () => {
  const legacy = { ...body, id: randomUUID(), dimension: null };
  assert.deepEqual(inventoryUnitSchema.parse(legacy), legacy);
  assert.equal(inventoryUnitSchema.safeParse({ ...body, id: legacy.id }).success, false);
  assert.equal(inventoryUnitSchema.safeParse({ ...legacy, dimension: "OTHER" }).success, false);
  assert.equal(createInventoryUnitSchema.safeParse({ ...body, dimension: null }).success, false);
});

test("dimension does not authorize client compatibility decisions, parent scope or audit input", () => {
  for (const field of [
    "compatible",
    "dimensionId",
    "tenantId",
    "definitionLocked",
    "factor",
    "actorId",
  ])
    assert.equal(
      createInventoryUnitSchema.safeParse({ ...body, dimension: "MASS", [field]: "1" }).success,
      false,
    );
});
