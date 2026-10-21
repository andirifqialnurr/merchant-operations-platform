import assert from "node:assert/strict";
import test from "node:test";

import { buildAuditMetadata } from "./core/audit/public.js";

test("category lifecycle has critical before/after status metadata without a free name or item counts", () => {
  assert.deepEqual(
    buildAuditMetadata("inventory.category.status_change", {
      before: { status: "ACTIVE" },
      after: { status: "INACTIVE" },
    }),
    { critical: true, before: { status: "ACTIVE" }, after: { status: "INACTIVE" } },
  );
});
