import { MODULES, type ModuleManifest } from "@merchant/contracts";

/** Packages, subscriptions, overrides, and what they add up to for a tenant. */
export const subscriptionManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  displayName: "Subscription and Entitlement Core",
  // Rebuilds the workspace's effective entitlements when a module is installed.
  eventHandlers: [{ eventType: "module.installed.v1", handlerKey: "core.entitlement_projection" }],
  // Written by core/installations when a module finishes installing.
  eventsProduced: ["module.installed.v1", "usage.threshold_reached.v1"],
  internalDependencies: [MODULES.coreTenancy],
  key: MODULES.coreSubscription,
  limitDimensions: [],
  namespaces: [],
  navigation: [],
  permissions: [],
  routes: [],
  configSchemaVersion: 1,
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS", "PERSONAL"],
  version: "1.0.0",
};
