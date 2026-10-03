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
  assert.equal(formatMoney("25000", "USD", "en-US"), "$25,000");
});

test("shows the raw value instead of a wrong number when it cannot be formatted exactly", () => {
  assert.equal(formatMoney("900719925474099312345"), "900719925474099312345 IDR");
  assert.equal(formatMoney("12.5"), "12.5 IDR");
  assert.equal(formatMoney("abc"), "abc IDR");
});

test("builds slugs from names", () => {
  assert.equal(slugify("  Es Kopi Susu  "), "es-kopi-susu");
  assert.equal(slugify("Non-Kopi & Teh!"), "non-kopi-teh");
  assert.equal(slugify("---"), "");
});
