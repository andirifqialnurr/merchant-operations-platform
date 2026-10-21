import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAuditMetadata } from "./core/audit/public.js";

test("unit updates are critical and their private refusal/definition conflict has id/en coverage", () => {
  assert.deepEqual(buildAuditMetadata("inventory.unit.update", {}), { critical: true });
  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(
      readFileSync(new URL(`../../web/messages/${locale}.json`, import.meta.url), "utf8"),
    ) as { errors: Record<string, string> };
    for (const code of [
      "INVENTORY_UNIT_NOT_FOUND",
      "INVENTORY_UNIT_DEFINITION_LOCKED",
      "INVENTORY_UNIT_CODE_TAKEN",
    ])
      assert.ok(errors[code]);
  }
});
