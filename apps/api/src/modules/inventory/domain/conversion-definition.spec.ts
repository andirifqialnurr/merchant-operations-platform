import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryUnitConversionSchema } from "@merchant/contracts";

import {
  normalizeInventoryConversionFactor,
  normalizeInventoryUnitConversion,
} from "./conversion-definition.js";

test("factor normalization shared by create/update preserves tiny, maximal and unsafe-integer digits exactly", () => {
  for (const [input, expected] of [
    ["1000.000000000000", "1000"],
    ["1000", "1000"],
    ["0.01000", "0.01"],
    ["0.000000000001", "0.000000000001"],
    ["999999999999999999.999999999999", "999999999999999999.999999999999"],
    ["9007199254740993.000001", "9007199254740993.000001"],
  ]) {
    assert.equal(normalizeInventoryConversionFactor(input!), expected);
    assert.equal(normalizeInventoryConversionFactor(expected!), expected);
  }
});

const fromUnitId = "01990000-aaaa-7000-8000-000000000001";
const toUnitId = "01990000-bbbb-7000-8000-000000000002";

test("conversion logical identity canonicalizes UUID case and trailing zeros without changing exact digits", () => {
  for (const [factor, expected] of [
    ["1000.000000000000", "1000"],
    ["10", "10"],
    ["0.01000", "0.01"],
    ["0.000000000001", "0.000000000001"],
    ["999999999999999999.999999999999", "999999999999999999.999999999999"],
    ["9007199254740993.000001", "9007199254740993.000001"],
  ]) {
    const parsed = createInventoryUnitConversionSchema.parse({
      fromUnitId: fromUnitId.toUpperCase(),
      toUnitId: toUnitId.toUpperCase(),
      factor,
    });
    const result = normalizeInventoryUnitConversion(parsed);
    assert.deepEqual(result, { fromUnitId, toUnitId, factor: expected });
    assert.deepEqual(normalizeInventoryUnitConversion(result), result);
    assert.equal(parsed.fromUnitId, fromUnitId.toUpperCase());
  }
});
