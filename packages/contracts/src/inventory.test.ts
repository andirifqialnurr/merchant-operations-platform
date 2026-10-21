import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createInventoryUnitConversionSchema,
  createInventoryUnitSchema,
  inventoryConversionFactorSchema,
  inventoryNonnegativeQuantitySchema,
  inventoryPositiveQuantitySchema,
  inventoryQuantitySchema,
  inventoryUnitPrecisionSchema,
  inventoryUnitSchema,
} from "./inventory.ts";

test("inventory unit precision is an explicit finite integer from zero to six", () => {
  for (let precision = 0; precision <= 6; precision++)
    assert.equal(inventoryUnitPrecisionSchema.parse(precision), precision);
  for (const precision of [-1, 7, 1.5, NaN, Infinity, "3", null, undefined])
    assert.equal(inventoryUnitPrecisionSchema.safeParse(precision).success, false);
});

test("inventory quantities use bounded decimal strings, never JSON floats, exponent or locale separators", () => {
  for (const quantity of ["0", "-0.000", "1.2500", "-12.345678", "999999999999999999999999.999999"])
    assert.equal(inventoryQuantitySchema.safeParse(quantity).success, true);
  for (const quantity of [
    0,
    0.1,
    9007199254740992,
    null,
    undefined,
    "",
    " 1",
    "1 ",
    "+1",
    "01",
    ".5",
    "1.",
    "1e3",
    "1,5",
    "1,000",
    "NaN",
    "Infinity",
    "0.0000001",
    "1000000000000000000000000",
  ])
    assert.equal(inventoryQuantitySchema.safeParse(quantity).success, false);
});

test("positive and nonnegative user quantities are distinct from signed ledger quantities", () => {
  for (const quantity of ["0", "0.000", "1", "0.000001"])
    assert.equal(inventoryNonnegativeQuantitySchema.safeParse(quantity).success, true);
  for (const quantity of ["-0", "-0.001", "-1"])
    assert.equal(inventoryNonnegativeQuantitySchema.safeParse(quantity).success, false);
  for (const quantity of ["0", "0.000000", "-0", "-1"])
    assert.equal(inventoryPositiveQuantitySchema.safeParse(quantity).success, false);
  for (const quantity of ["1.000", "0.000001", "9007199254740993"])
    assert.equal(inventoryPositiveQuantitySchema.safeParse(quantity).success, true);
});

test("conversion factors are positive exact decimal strings within numeric(30,12)", () => {
  for (const factor of ["1", "1000", "0.001", "0.000000000001", "999999999999999999.999999999999"])
    assert.equal(inventoryConversionFactorSchema.safeParse(factor).success, true);
  for (const factor of [
    1,
    0.001,
    "0",
    "0.000000000000",
    "-1",
    "-0.001",
    "1e-3",
    "1,000",
    " 1",
    "01",
    "0.0000000000001",
    "1000000000000000000",
  ])
    assert.equal(inventoryConversionFactorSchema.safeParse(factor).success, false);
});

test("unit creation owns only code/name/precision/dimension, never IDs, balance, cost, actor or scope", () => {
  const unit = { code: "mL", name: " Milliliter ", precision: 3, dimension: "VOLUME" };
  assert.deepEqual(createInventoryUnitSchema.parse(unit), { ...unit, name: "Milliliter" });
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "actorId",
    "createdAt",
    "balance",
    "quantity",
    "unitCostMinor",
    "status",
  ])
    assert.equal(createInventoryUnitSchema.safeParse({ ...unit, [field]: "1" }).success, false);
  for (const code of ["", " ", "kg g", "1kg", "<kg>", "a".repeat(25)])
    assert.equal(createInventoryUnitSchema.safeParse({ ...unit, code }).success, false);
  const read = { id: randomUUID(), code: "pcs", name: "Piece", precision: 0, dimension: "COUNT" };
  assert.deepEqual(inventoryUnitSchema.parse(read), read);
  assert.equal(inventoryUnitSchema.safeParse({ ...read, calculatedBalance: "0" }).success, false);
  assert.equal(inventoryUnitSchema.safeParse({ ...read, definitionLocked: true }).success, false);
  assert.equal(
    createInventoryUnitSchema.safeParse({ ...unit, definitionLocked: true }).success,
    false,
  );
});

test("conversion definition requires different unit IDs and does not accept a derived result or scope", () => {
  const conversion = { fromUnitId: randomUUID(), toUnitId: randomUUID(), factor: "1000" };
  assert.deepEqual(createInventoryUnitConversionSchema.parse(conversion), conversion);
  assert.equal(
    createInventoryUnitConversionSchema.safeParse({
      ...conversion,
      toUnitId: conversion.fromUnitId,
    }).success,
    false,
  );
  const sameUnit = "01990000-aaaa-7000-8000-000000000001";
  assert.equal(
    createInventoryUnitConversionSchema.safeParse({
      fromUnitId: sameUnit,
      toUnitId: sameUnit.toUpperCase(),
      factor: "1",
    }).success,
    false,
  );
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "convertedQuantity",
    "balance",
    "costMinor",
    "actorId",
  ])
    assert.equal(
      createInventoryUnitConversionSchema.safeParse({ ...conversion, [field]: "1" }).success,
      false,
    );
});
