import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAuditMetadata } from "./core/audit/public.js";

test("category rename is critical without free-name audit duplication and private errors have id/en labels", () => {
  assert.deepEqual(buildAuditMetadata("inventory.category.update", { nameChanged: true }), {
    critical: true,
    nameChanged: true,
  });
  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(
      readFileSync(new URL(`../../web/messages/${locale}.json`, import.meta.url), "utf8"),
    ) as { errors: Record<string, string> };
    for (const code of ["INVENTORY_CATEGORY_NOT_FOUND", "INVENTORY_CATEGORY_NAME_TAKEN"])
      assert.ok(errors[code]);
  }
});
