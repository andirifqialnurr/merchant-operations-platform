import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAuditMetadata } from "./core/audit/public.js";

test("category creation is critical and CI conflict has neutral id/en dictionary coverage", () => {
  assert.deepEqual(
    buildAuditMetadata("inventory.category.create", { after: { status: "ACTIVE" } }),
    { critical: true, after: { status: "ACTIVE" } },
  );
  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(
      readFileSync(new URL(`../../web/messages/${locale}.json`, import.meta.url), "utf8"),
    ) as { errors: Record<string, string> };
    assert.ok(errors.INVENTORY_CATEGORY_NAME_TAKEN);
  }
});
