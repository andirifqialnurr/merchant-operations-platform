import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEffectiveEntitlementRows,
  effectiveCapabilities,
  effectiveLimits,
  type TargetOverride,
} from "./effective-entitlements.js";

const NOW = new Date("2026-10-10T00:00:00.000Z");
const at = (iso: string) => new Date(iso);

function override(
  input: Partial<TargetOverride> & Pick<TargetOverride, "operation" | "targetKey">,
) {
  return {
    effectiveAt: at("2026-10-01T00:00:00.000Z"),
    endsAt: null,
    targetType:
      input.operation === "GRANT" || input.operation === "REVOKE" ? "CAPABILITY" : "LIMIT",
    value: null,
    ...input,
  } as TargetOverride;
}

test("capabilities are the package's inclusions with overrides applied in order", () => {
  const packageCapabilities = [
    { capabilityKey: "pos.split_bill", included: true },
    { capabilityKey: "pos.offline_advanced", included: false },
    { capabilityKey: "kds.routing", included: true },
  ];
  const overrides = [
    override({ operation: "REVOKE", targetKey: "kds.routing" }),
    override({ operation: "GRANT", targetKey: "pos.offline_advanced" }),
    // Granted, then revoked later: the later decision wins.
    override({ operation: "GRANT", targetKey: "pos.tips" }),
    override({
      effectiveAt: at("2026-10-05T00:00:00.000Z"),
      operation: "REVOKE",
      targetKey: "pos.tips",
    }),
  ];

  assert.deepEqual(effectiveCapabilities(packageCapabilities, overrides, NOW), [
    "pos.offline_advanced",
    "pos.split_bill",
  ]);
});

test("an override outside its period changes nothing", () => {
  const overrides = [
    override({
      endsAt: at("2026-10-09T00:00:00.000Z"),
      operation: "GRANT",
      targetKey: "pos.ended",
    }),
    override({
      effectiveAt: at("2026-10-11T00:00:00.000Z"),
      operation: "GRANT",
      targetKey: "pos.later",
    }),
    override({
      endsAt: at("2026-10-09T00:00:00.000Z"),
      operation: "REPLACE",
      targetKey: "core.users.active",
      value: 99n,
    }),
  ];

  assert.deepEqual(effectiveCapabilities([], overrides, NOW), []);
  assert.deepEqual(
    effectiveLimits(
      [{ dimensionKey: "core.users.active", unlimited: false, value: 5n }],
      overrides,
      NOW,
    ),
    [{ dimensionKey: "core.users.active", source: "PACKAGE", unlimited: false, value: 5n }],
  );
});

test("limit overrides replace or add, and never shrink an unlimited package limit", () => {
  const packageLimits = [
    { dimensionKey: "core.locations.active", unlimited: false, value: 1n },
    { dimensionKey: "core.users.active", unlimited: false, value: 5n },
    { dimensionKey: "pos.registers.active", unlimited: true, value: null },
  ];
  const overrides = [
    override({ operation: "ADD", targetKey: "core.locations.active", value: 2n }),
    override({ operation: "REPLACE", targetKey: "core.users.active", value: 20n }),
    override({ operation: "ADD", targetKey: "pos.registers.active", value: 3n }),
    // The package says nothing about this dimension: adding starts from zero.
    override({ operation: "ADD", targetKey: "kds.devices.active", value: 4n }),
  ];

  assert.deepEqual(effectiveLimits(packageLimits, overrides, NOW), [
    { dimensionKey: "core.locations.active", source: "OVERRIDE", unlimited: false, value: 3n },
    { dimensionKey: "core.users.active", source: "OVERRIDE", unlimited: false, value: 20n },
    { dimensionKey: "kds.devices.active", source: "OVERRIDE", unlimited: false, value: 4n },
    { dimensionKey: "pos.registers.active", source: "PACKAGE", unlimited: true, value: null },
  ]);
});

test("each capability and limit lands on exactly one module row", () => {
  const rows = buildEffectiveEntitlementRows(
    [
      { moduleKey: "POS", tier: "PRO" },
      { moduleKey: "CORE_TENANCY", tier: "BASIC" },
      { moduleKey: "CORE_SUBSCRIPTION", tier: "BASIC" },
      { moduleKey: "TABLE_SELF_ORDER", tier: "BASIC" },
    ],
    ["floor.layout_editor", "pos.split_bill", "reports.export_csv", "self_order.qr"],
    [
      { dimensionKey: "api.requests.cycle", source: "PACKAGE", unlimited: false, value: 1000n },
      { dimensionKey: "core.locations.active", source: "PACKAGE", unlimited: false, value: 1n },
      { dimensionKey: "pos.registers.active", source: "OVERRIDE", unlimited: false, value: 2n },
    ],
  );
  const row = (key: string) => rows.find((item) => item.moduleKey === key);

  assert.deepEqual(
    rows.map((item) => item.moduleKey),
    ["CORE_SUBSCRIPTION", "CORE_TENANCY", "POS", "TABLE_SELF_ORDER"],
  );
  assert.deepEqual(row("POS")?.capabilities, ["pos.split_bill"]);
  assert.deepEqual(
    row("POS")?.limits.map((item) => item.dimensionKey),
    ["pos.registers.active"],
  );
  assert.deepEqual(row("TABLE_SELF_ORDER")?.capabilities, ["floor.layout_editor", "self_order.qr"]);
  assert.deepEqual(
    row("CORE_TENANCY")?.limits.map((item) => item.dimensionKey),
    ["core.locations.active"],
  );
  // No enabled module claims "reports" or "api": they stay visible on the subscription row.
  assert.deepEqual(row("CORE_SUBSCRIPTION")?.capabilities, ["reports.export_csv"]);
  assert.deepEqual(
    row("CORE_SUBSCRIPTION")?.limits.map((item) => item.dimensionKey),
    ["api.requests.cycle"],
  );

  const total = rows.reduce((sum, item) => sum + item.capabilities.length + item.limits.length, 0);
  assert.equal(total, 7);
});
