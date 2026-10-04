import assert from "node:assert/strict";
import test from "node:test";

import { formatMoney, slugify } from "./format";

test("formats minor-unit strings as rupiah without decimals or spaces", () => {
  assert.equal(formatMoney("25000"), "Rp25.000");
  assert.equal(formatMoney("0"), "Rp0");
  assert.equal(formatMoney("-5000"), "-Rp5.000");
  assert.equal(formatMoney("1250000"), "Rp1.250.000");
});

test("follows the requested locale and currency", () => {
  assert.equal(formatMoney("25000", "IDR", "en-US"), "Rp25,000");
});

test("one minor unit of USD is one cent, in either language", () => {
  assert.equal(formatMoney("1025", "USD", "en-US"), "$10.25");
  assert.equal(formatMoney("1025", "USD", "id-ID"), "$10,25");
  assert.equal(formatMoney("0", "USD", "en-US"), "$0.00");
  assert.equal(formatMoney("5", "USD", "en-US"), "$0.05");
  assert.equal(formatMoney("-1999", "USD", "en-US"), "-$19.99");
  assert.equal(formatMoney("123456789012345678", "USD", "en-US"), "$1,234,567,890,123,456.78");
});

test("rupiah amounts stored before USD existed read exactly as before", () => {
  for (const [minor, text] of [
    ["1", "Rp1"],
    ["25000", "Rp25.000"],
    ["999999999", "Rp999.999.999"],
  ] as const) {
    assert.equal(formatMoney(minor, "IDR", "id-ID"), text);
  }
});

test("shows the raw value instead of a wrong number when it cannot be formatted exactly", () => {
  assert.equal(formatMoney("900719925474099312345"), "Rp900.719.925.474.099.312.345");
  assert.equal(formatMoney("12.5"), "12.5 IDR");
  assert.equal(formatMoney("abc"), "abc IDR");
});

test("builds slugs from names", () => {
  assert.equal(slugify("  Es Kopi Susu  "), "es-kopi-susu");
  assert.equal(slugify("Non-Kopi & Teh!"), "non-kopi-teh");
  assert.equal(slugify("---"), "");
});
