import assert from "node:assert/strict";
import test from "node:test";

import { haveCompatibleInventoryUnitDimensions } from "./unit-dimension.js";

const dimensions = ["MASS", "VOLUME", "COUNT", "LENGTH", "AREA"];

test("only equal explicit physical dimensions satisfy the necessary compatibility check", () => {
  for (const from of dimensions)
    for (const to of dimensions)
      assert.equal(haveCompatibleInventoryUnitDimensions(from, to), from === to);
});

test("unknown legacy dimensions never become mutually compatible or a COUNT fallback", () => {
  for (const unknown of [null, undefined, "", "OTHER", "mass", "kg", 0, {}, ["MASS"]]) {
    assert.equal(haveCompatibleInventoryUnitDimensions(unknown, unknown), false);
    for (const dimension of dimensions) {
      assert.equal(haveCompatibleInventoryUnitDimensions(unknown, dimension), false);
      assert.equal(haveCompatibleInventoryUnitDimensions(dimension, unknown), false);
    }
  }
});
