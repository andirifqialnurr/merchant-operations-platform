import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAuditMetadata } from "./core/audit/public.js";

test("factor updates are critical and private missing-target/dimension errors have id/en labels", () => {
  assert.deepEqual(buildAuditMetadata("inventory.unit_conversion.update", {}), { critical: true });
  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(
      readFileSync(new URL(`../../web/messages/${locale}.json`, import.meta.url), "utf8"),
    ) as { errors: Record<string, string> };
    for (const code of ["INVENTORY_CONVERSION_NOT_FOUND", "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE"])
      assert.ok(errors[code]);
  }
});
