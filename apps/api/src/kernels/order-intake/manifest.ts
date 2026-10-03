import { MODULES, type ModuleManifest } from "@merchant/contracts";

/** Order kernel: owns orders and announces when one is submitted or canceled. */
export const orderIntakeManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  displayName: "Order Core",
  eventsProduced: ["order.submitted.v1", "order.canceled.v1"],
  internalDependencies: [MODULES.coreCatalog],
  key: MODULES.coreOrder,
  limitDimensions: [],
  namespaces: [],
  navigation: [],
  permissions: [],
  routes: [],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
