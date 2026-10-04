import assert from "node:assert/strict";
import test from "node:test";

import { createOutletSchema, updateOutletSchema } from "./organization.ts";

const outlet = {
  brandId: "019f738d-e61f-7d46-92de-17b35f970b91",
  code: "BDG-01",
  name: "Bandung",
};

test("outlet time zones accept real IANA names, including names with multiple segments", () => {
  for (const timezone of [
    "UTC",
    "Asia/Jakarta",
    "Asia/Makassar",
    "Asia/Jayapura",
    "America/Argentina/Buenos_Aires",
    "Etc/GMT+7",
  ]) {
    assert.equal(createOutletSchema.parse({ ...outlet, timezone }).timezone, timezone);
    assert.equal(updateOutletSchema.parse({ timezone }).timezone, timezone);
  }
  assert.equal(updateOutletSchema.parse({ timezone: " Asia/Jakarta " }).timezone, "Asia/Jakarta");
});

test("an unknown zone or numeric offset cannot be saved as an outlet IANA zone", () => {
  for (const timezone of ["Asia/Unknown", "Mars/Olympus", "WIB", "+07:00", "", "Asia//Jakarta"]) {
    assert.equal(createOutletSchema.safeParse({ ...outlet, timezone }).success, false, timezone);
    assert.equal(updateOutletSchema.safeParse({ timezone }).success, false, timezone);
  }
});

test("outlet address can be omitted, trimmed, or explicitly removed without accepting blank input", () => {
  assert.equal(createOutletSchema.parse(outlet).address, undefined);
  assert.equal(updateOutletSchema.parse({ address: null }).address, null);
  assert.equal(updateOutletSchema.parse({ address: " Jl. Merdeka " }).address, "Jl. Merdeka");
  for (const address of ["", "  ", "ab", "x".repeat(501)]) {
    assert.equal(createOutletSchema.safeParse({ ...outlet, address }).success, false);
    assert.equal(updateOutletSchema.safeParse({ address }).success, false);
  }
});
