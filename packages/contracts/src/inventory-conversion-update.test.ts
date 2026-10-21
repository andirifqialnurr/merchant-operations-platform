import assert from "node:assert/strict";
import test from "node:test";

import { updateInventoryUnitConversionSchema } from "./inventory.ts";

test("conversion update requires exactly one explicit positive exact factor string", () => {
  for (const factor of [
    "1",
    "1000.000000000000",
    "0.000000000001",
    "999999999999999999.999999999999",
    "9007199254740993.000001",
  ])
    assert.deepEqual(updateInventoryUnitConversionSchema.parse({ factor }), { factor });
  for (const input of [{}, { factor: undefined }, { factor: null }, null, [], "1"])
    assert.equal(updateInventoryUnitConversionSchema.safeParse(input).success, false);
});

test("conversion update never coerces, localizes, truncates or rounds invalid factor input", () => {
  for (const factor of [
    1,
    0,
    "0",
    "0.000",
    "-1",
    "1e3",
    "1,5",
    " 1 ",
    "01",
    "NaN",
    "Infinity",
    "0.0000000000001",
    "1000000000000000000",
  ])
    assert.equal(
      updateInventoryUnitConversionSchema.safeParse({ factor }).success,
      false,
      String(factor),
    );
});

test("conversion update cannot change binding, identity, scope, dimension or historical/derived data", () => {
  for (const field of [
    "id",
    "fromUnitId",
    "toUnitId",
    "tenantId",
    "outletId",
    "actorId",
    "dimension",
    "precision",
    "status",
    "reason",
    "createdAt",
    "updatedAt",
    "expectedVersion",
    "convertedQuantity",
    "balance",
    "unitCostMinor",
  ])
    for (const value of ["1", undefined])
      assert.equal(
        updateInventoryUnitConversionSchema.safeParse({ factor: "1", [field]: value }).success,
        false,
        field,
      );
});
