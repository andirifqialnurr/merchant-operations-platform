import { MODULES, type ModuleManifest } from "@merchant/contracts";

/** Audit trail and idempotency records. */
export const auditManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  displayName: "Audit and Idempotency Core",
  eventsProduced: [],
  internalDependencies: [],
  key: MODULES.coreAudit,
  limitDimensions: [],
  namespaces: [],
  navigation: [],
  permissions: [],
  routes: [],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS", "PERSONAL"],
  version: "1.0.0",
};
