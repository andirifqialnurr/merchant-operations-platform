import assert from "node:assert/strict";
import test from "node:test";
import {
  convertInventoryQuantity,
  formatInventoryQuantity,
  parseInventoryQuantity,
} from "./quantity.js";

const converted = (
  quantity: unknown,
  fromPrecision: unknown,
  toPrecision: unknown,
  factor: unknown,
) => convertInventoryQuantity({ quantity, fromPrecision, toPrecision, factor });

test("fractional quantities become exact unit atoms without binary floating point", () => {
  assert.deepEqual(parseInventoryQuantity("0.1", 6), { ok: true, value: 100000n });
  assert.deepEqual(parseInventoryQuantity("0.2", 6), { ok: true, value: 200000n });
  assert.deepEqual(formatInventoryQuantity(100000n + 200000n, 6), { ok: true, value: "0.3" });
  assert.deepEqual(parseInventoryQuantity("1.234567", 6), { ok: true, value: 1234567n });
});

test("signed ledger values and signed zero format canonically without deciding negative-stock policy", () => {
  assert.deepEqual(parseInventoryQuantity("-12.3400", 4), { ok: true, value: -123400n });
  assert.deepEqual(formatInventoryQuantity(-123400n, 4), { ok: true, value: "-12.34" });
  for (let precision = 0; precision <= 6; precision++) {
    assert.deepEqual(parseInventoryQuantity("-0.000000", precision), { ok: true, value: 0n });
    assert.deepEqual(formatInventoryQuantity(0n, precision), { ok: true, value: "0" });
  }
});

test("trailing zeros are harmless but nonzero fractions beyond a unit's precision are rejected", () => {
  assert.deepEqual(parseInventoryQuantity("1.000000", 0), { ok: true, value: 1n });
  assert.deepEqual(parseInventoryQuantity("1.230000", 2), { ok: true, value: 123n });
  assert.deepEqual(parseInventoryQuantity("1.234", 2), {
    ok: false,
    problem: "INVENTORY_QUANTITY_PRECISION_EXCEEDED",
  });
  assert.deepEqual(parseInventoryQuantity("0.000001", 0), {
    ok: false,
    problem: "INVENTORY_QUANTITY_PRECISION_EXCEEDED",
  });
});

test("values above Number.MAX_SAFE_INTEGER and the full SQL quantity range stay exact", () => {
  assert.deepEqual(parseInventoryQuantity("9007199254740993.123456", 6), {
    ok: true,
    value: 9007199254740993123456n,
  });
  const maximum = 10n ** 30n - 1n;
  assert.deepEqual(parseInventoryQuantity("999999999999999999999999.999999", 6), {
    ok: true,
    value: maximum,
  });
  assert.deepEqual(formatInventoryQuantity(maximum, 6), {
    ok: true,
    value: "999999999999999999999999.999999",
  });
  assert.deepEqual(formatInventoryQuantity(-maximum, 6), {
    ok: true,
    value: "-999999999999999999999999.999999",
  });
  for (const atoms of [maximum + 1n, -maximum - 1n])
    assert.deepEqual(formatInventoryQuantity(atoms, 6), {
      ok: false,
      problem: "INVENTORY_QUANTITY_OUT_OF_RANGE",
    });
  assert.deepEqual(formatInventoryQuantity(10n ** 24n, 0), {
    ok: false,
    problem: "INVENTORY_QUANTITY_OUT_OF_RANGE",
  });
});

test("invalid representations and invalid unit precision return failures, not guessed stock", () => {
  for (const quantity of [0.1, "1e3", "NaN", "1,5", "1 000", ".1", "00.1", "1.0000001", undefined])
    assert.deepEqual(parseInventoryQuantity(quantity, 6), {
      ok: false,
      problem: "INVENTORY_QUANTITY_INVALID",
    });
  for (const precision of [-1, 7, 0.5, NaN, Infinity, "3", undefined]) {
    assert.deepEqual(parseInventoryQuantity("1", precision), {
      ok: false,
      problem: "INVENTORY_UNIT_PRECISION_INVALID",
    });
    assert.deepEqual(formatInventoryQuantity(1n, precision), {
      ok: false,
      problem: "INVENTORY_UNIT_PRECISION_INVALID",
    });
  }
});

test("direct kg/g and fractional pack conversions use explicit exact factors", () => {
  assert.deepEqual(converted("1.234", 3, 0, "1000"), { ok: true, value: "1234" });
  assert.deepEqual(converted("1234", 0, 3, "0.001"), { ok: true, value: "1.234" });
  assert.deepEqual(converted("0.25", 2, 0, "12"), { ok: true, value: "3" });
  assert.deepEqual(converted("-0.25", 2, 0, "12"), { ok: true, value: "-3" });
  assert.deepEqual(converted("1.250000", 6, 2, "1.000000000000"), { ok: true, value: "1.25" });
});

test("small factors and large coefficients are not rounded to zero or a safe integer", () => {
  assert.deepEqual(converted("1000000000000", 0, 0, "0.000000000001"), { ok: true, value: "1" });
  assert.deepEqual(converted("1", 0, 6, "0.000001"), { ok: true, value: "0.000001" });
  assert.deepEqual(converted("9007199254740993", 0, 0, "10"), {
    ok: true,
    value: "90071992547409930",
  });
});

test("inexact conversions fail for both signs instead of silently rounding stock", () => {
  for (const quantity of ["1", "-1"]) {
    assert.deepEqual(converted(quantity, 0, 0, "0.001"), {
      ok: false,
      problem: "INVENTORY_CONVERSION_INEXACT",
    });
    assert.deepEqual(converted(quantity, 0, 6, "0.000000000001"), {
      ok: false,
      problem: "INVENTORY_CONVERSION_INEXACT",
    });
  }
});

test("invalid factor/precision, overflow and malformed quantities fail closed", () => {
  for (const factor of [
    0,
    1,
    "0",
    "-1",
    "0.000000000000",
    "1e-3",
    "0.0000000000001",
    "1000000000000000000",
    null,
  ])
    assert.deepEqual(converted("1", 0, 6, factor), {
      ok: false,
      problem: "INVENTORY_CONVERSION_FACTOR_INVALID",
    });
  assert.deepEqual(converted("1", 7, 0, "1"), {
    ok: false,
    problem: "INVENTORY_UNIT_PRECISION_INVALID",
  });
  assert.deepEqual(converted("1", 0, "3", "1"), {
    ok: false,
    problem: "INVENTORY_UNIT_PRECISION_INVALID",
  });
  assert.deepEqual(converted("1e3", 0, 0, "1"), {
    ok: false,
    problem: "INVENTORY_QUANTITY_INVALID",
  });
  for (const quantity of ["999999999999999999999999", "-999999999999999999999999"])
    assert.deepEqual(converted(quantity, 0, 6, "1000"), {
      ok: false,
      problem: "INVENTORY_QUANTITY_OUT_OF_RANGE",
    });
});

test("round-trip and reversible explicit decimal conversions preserve every tested atom", () => {
  for (let precision = 0; precision <= 6; precision++) {
    for (const atoms of [0n, 1n, -1n, 123456n, -123456n, 9007199254740993n]) {
      const formatted = formatInventoryQuantity(atoms, precision);
      assert.ok(formatted.ok);
      assert.deepEqual(parseInventoryQuantity(formatted.value, precision), {
        ok: true,
        value: atoms,
      });
      const up = converted(formatted.value, precision, precision, "10");
      assert.ok(up.ok);
      assert.deepEqual(converted(up.value, precision, precision, "0.1"), formatted);
    }
  }
});
