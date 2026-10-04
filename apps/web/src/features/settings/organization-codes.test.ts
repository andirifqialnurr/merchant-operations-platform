import assert from "node:assert/strict";
import test from "node:test";

import { createBrandSchema, createOutletSchema } from "@merchant/contracts";

import { outletCodeFromName, slugFromName } from "./organization-codes.ts";

test("a brand name becomes a slug the API accepts", () => {
  assert.equal(slugFromName("  Kopi Lokal & Roti  "), "kopi-lokal-roti");
  assert.equal(slugFromName("Café Senja"), "cafe-senja");
  for (const name of ["Kopi Lokal", "Café Senja", "A".repeat(120), `${"ab ".repeat(40)}`]) {
    assert.ok(createBrandSchema.safeParse({ name: "Brand", slug: slugFromName(name) }).success);
  }
});

test("an outlet name becomes a code the API accepts", () => {
  assert.equal(outletCodeFromName("Cabang Dago (Atas)"), "CABANG-DAGO-ATAS");
  for (const name of ["Cabang Dago", "Outlet 2", "B".repeat(90), `${"cd ".repeat(30)}`]) {
    assert.ok(
      createOutletSchema.safeParse({
        brandId: "019a0000-0000-7000-8000-000000000001",
        code: outletCodeFromName(name),
        name: "Outlet",
      }).success,
    );
  }
});

test("a name without letters or digits gives nothing, so the form can refuse it", () => {
  assert.equal(slugFromName("—"), "");
  assert.equal(outletCodeFromName("!!"), "");
});
