import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

import { MODULE_MANIFESTS } from "../../module-manifests.js";
import { ModuleManifestRegistry } from "./module-manifest.registry.js";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function manifest(
  overrides: Partial<ModuleManifest> & Pick<ModuleManifest, "key">,
): ModuleManifest {
  return {
    capabilities: [],
    capabilityTiers: {},
    configSchemaVersion: 1,
    displayName: "Test module",
    eventHandlers: [],
    eventsProduced: [],
    installSteps: [],
    internalDependencies: [],
    limitDimensions: [],
    namespaces: [],
    navigation: [],
    permissions: [],
    routes: [],
    settings: [],
    supportedWorkspaceTypes: ["BUSINESS"],
    version: "1.0.0",
    ...overrides,
  };
}

test("the manifests of this API form a consistent registry", () => {
  const registry = new ModuleManifestRegistry(MODULE_MANIFESTS);
  assert.equal(registry.all().length, MODULE_MANIFESTS.length);
  assert.equal(registry.get(MODULES.pos)?.displayName, "POS and Sales");
});

test("a manifest that contradicts itself or another one is refused at start-up", () => {
  const pos = manifest({ key: MODULES.pos, namespaces: ["pos"] });
  assert.throws(() => new ModuleManifestRegistry([pos, pos]), /more than one manifest/);
  assert.throws(
    () => new ModuleManifestRegistry([pos, manifest({ key: MODULES.kds, namespaces: ["pos"] })]),
    /Namespace "pos" is claimed by POS and KDS/,
  );
  assert.throws(
    () =>
      new ModuleManifestRegistry([
        manifest({ internalDependencies: [MODULES.coreOrder], key: MODULES.pos }),
      ]),
    /depends on modules without a manifest: CORE_ORDER/,
  );
  assert.throws(
    () =>
      new ModuleManifestRegistry([
        manifest({
          eventHandlers: [{ eventType: "order.submitted.v1", handlerKey: "kds.create_ticket" }],
          key: MODULES.kds,
        }),
      ]),
    /handles order\.submitted\.v1, which no module produces/,
  );
  // A capability outside the module's own namespace.
  assert.throws(
    () =>
      new ModuleManifestRegistry([
        manifest({ capabilities: ["kds.routing.rule"], key: MODULES.pos, namespaces: ["pos"] }),
      ]),
  );
  // A tier for a capability the module does not declare.
  assert.throws(
    () =>
      new ModuleManifestRegistry([
        manifest({ capabilityTiers: { "pos.bill.split": "PRO" }, key: MODULES.pos }),
      ]),
  );
});

test("a tier gives its own capabilities and those of the tiers below", () => {
  const registry = new ModuleManifestRegistry(MODULE_MANIFESTS);
  const basic = registry.capabilitiesAt(MODULES.pos, "BASIC");
  const pro = registry.capabilitiesAt(MODULES.pos, "PRO");
  const advanced = registry.capabilitiesAt(MODULES.pos, "ADVANCED");

  assert.ok(basic.includes("pos.order.create"));
  assert.ok(!basic.includes("pos.bill.split"));
  assert.ok(pro.includes("pos.bill.split") && pro.includes("pos.order.create"));
  assert.ok(!pro.includes("pos.policy.central"));
  assert.equal(advanced.length, registry.get(MODULES.pos)?.capabilities.length);
  // A module that is planned but not built gives nothing by default.
  assert.deepEqual(registry.capabilitiesAt(MODULES.kds, "ADVANCED"), []);
});

test("capability and limit keys belong to the module that owns their namespace", () => {
  const registry = new ModuleManifestRegistry(MODULE_MANIFESTS);
  assert.equal(registry.ownerOf("pos.refund.simple"), MODULES.pos);
  assert.equal(registry.ownerOf("catalog.products.active"), MODULES.coreCatalog);
  assert.equal(registry.ownerOf("core.locations.active"), MODULES.coreTenancy);
  // Planned modules keep their namespaces until they bring a manifest.
  assert.equal(registry.ownerOf("kds.devices.active"), MODULES.kds);
  assert.equal(registry.ownerOf("self_order.order.submit"), MODULES.tableSelfOrder);
  assert.equal(registry.ownerOf("reports.exports.cycle"), undefined);
});

test("the menu shows only enabled modules and entries the user may open", () => {
  const registry = new ModuleManifestRegistry(MODULE_MANIFESTS);
  const both = new Set([MODULES.pos, MODULES.coreCatalog]);

  assert.deepEqual(
    registry
      .navigationFor(both, [PERMISSIONS.orderCreate, PERMISSIONS.catalogRead])
      .map((item) => item.path),
    ["/catalog", "/pos"],
  );
  // A cashier has no catalog permission.
  assert.deepEqual(registry.navigationFor(both, [PERMISSIONS.orderCreate]), [
    { label: "Cashier", moduleKey: MODULES.pos, path: "/pos" },
  ]);
  // POS is not enabled for this workspace.
  assert.deepEqual(
    registry
      .navigationFor(new Set([MODULES.coreCatalog]), [
        PERMISSIONS.orderCreate,
        PERMISSIONS.catalogRead,
      ])
      .map((item) => item.path),
    ["/catalog"],
  );
});

test("a package is checked against the manifests before it can be trusted", () => {
  const registry = new ModuleManifestRegistry(MODULE_MANIFESTS);
  const core = [
    MODULES.coreCatalog,
    MODULES.coreOrder,
    MODULES.coreBill,
    MODULES.corePaymentLedger,
  ].map((moduleKey) => ({ moduleKey, tier: "BASIC" as const }));

  assert.deepEqual(
    registry.validatePackage({
      capabilities: [{ capabilityKey: "pos.bill.split", included: true }],
      limits: [{ dimensionKey: "pos.registers.active" }],
      modules: [...core, { moduleKey: MODULES.pos, tier: "BASIC" }],
    }),
    [],
  );
  assert.deepEqual(
    registry.validatePackage({
      capabilities: [
        { capabilityKey: "pos.teleport", included: true },
        { capabilityKey: "reports.custom", included: true },
        { capabilityKey: "catalog.price.rule", included: true },
      ],
      limits: [{ dimensionKey: "pos.planets.active" }],
      modules: [{ moduleKey: MODULES.pos, tier: "BASIC" }],
    }),
    [
      "POS needs CORE_CATALOG, which the package does not include.",
      "POS needs CORE_ORDER, which the package does not include.",
      "POS needs CORE_BILL, which the package does not include.",
      "POS needs CORE_PAYMENT_LEDGER, which the package does not include.",
      "POS does not declare the capability pos.teleport.",
      "No module owns the capability reports.custom.",
      "catalog.price.rule belongs to CORE_CATALOG, which the package does not include.",
      "POS does not declare the limit pos.planets.active.",
    ],
  );
});

test("every event a unit writes is declared in its manifest, and nothing else", () => {
  const unitOf: Record<string, string> = {
    CORE_BILL: "kernels/billing-payment-ledger",
    CORE_ORDER: "kernels/order-intake",
    CORE_PAYMENT_LEDGER: "kernels/billing-payment-ledger",
    // The installation flow and metering write the events the subscription core declares.
    CORE_SUBSCRIPTION: "core/installations+core/metering",
    POS: "modules/pos-sales",
  };
  const written = (unit: string) => {
    const found = new Set<string>();
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (
          entry.name.endsWith(".ts") &&
          !entry.name.endsWith(".spec.ts") &&
          entry.name !== "manifest.ts"
        ) {
          for (const match of readFileSync(path, "utf8").matchAll(
            /(?:type|eventType): "([a-z_.]+\.v[0-9]+)"/g,
          )) {
            if (match[1]) found.add(match[1]);
          }
        }
      }
    };
    for (const part of unit.split("+")) walk(join(src, ...part.split("/")));
    return found;
  };

  const declaredByUnit = new Map<string, Set<string>>();
  for (const item of MODULE_MANIFESTS) {
    const unit = unitOf[item.key];
    if (!unit) {
      assert.deepEqual(
        item.eventsProduced,
        [],
        `${item.key} declares events but its unit is not scanned`,
      );
      continue;
    }
    const declared = declaredByUnit.get(unit) ?? new Set<string>();
    for (const event of item.eventsProduced) declared.add(event);
    declaredByUnit.set(unit, declared);
  }
  for (const [unit, declared] of declaredByUnit) {
    assert.deepEqual([...written(unit)].sort(), [...declared].sort(), unit);
  }
});
