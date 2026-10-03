import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditMetadata,
  CRITICAL_AUDIT_ACTIONS,
  isCriticalAuditAction,
} from "./critical-action-audit.js";

test("classifies implemented critical write actions for audit logs", () => {
  for (const action of [
    "catalog_product.update",
    "catalog_outlet_product.update",
    "entitlement.override",
    "membership.update",
    "role.update",
    "subscription.replace",
    "tenant.update",
  ]) {
    assert.equal(isCriticalAuditAction(action), true, `${action} must stay critical`);
  }

  assert.equal(isCriticalAuditAction("catalog_category.create"), false);
  assert.ok(CRITICAL_AUDIT_ACTIONS.length >= 10);
});

test("marks critical audit metadata without dropping safe before and after snapshots", () => {
  const metadata = buildAuditMetadata("role.update", {
    after: { permissionKeys: ["catalog.manage"], status: "ACTIVE" },
    before: { permissionKeys: ["catalog.read"], status: "ACTIVE" },
  });

  assert.deepEqual(metadata, {
    after: { permissionKeys: ["catalog.manage"], status: "ACTIVE" },
    before: { permissionKeys: ["catalog.read"], status: "ACTIVE" },
    critical: true,
  });
});

test("rejects sensitive audit metadata before it can be persisted", () => {
  assert.throws(
    () =>
      buildAuditMetadata("membership.update", {
        after: { sessionToken: "secret" },
      }),
    /Sensitive audit metadata key rejected: after.sessionToken/,
  );

  assert.throws(
    () =>
      buildAuditMetadata("catalog_product.update", {
        rawPayload: { basePriceMinor: "25000" },
      }),
    /Sensitive audit metadata key rejected: rawPayload/,
  );
});
