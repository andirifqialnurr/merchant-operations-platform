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
  // An order follows its kitchen ticket. The kernel is always on, so these
  // reactions need no binding; without a kitchen the events never come.
  eventHandlers: [
    { eventType: "kitchen_ticket.started.v1", handlerKey: "order.kitchen_started" },
    { eventType: "kitchen_ticket.ready.v1", handlerKey: "order.kitchen_ready" },
    { eventType: "kitchen_ticket.served.v1", handlerKey: "order.kitchen_served" },
  ],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
