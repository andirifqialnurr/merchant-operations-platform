import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/** Workspace, business unit, and location structure, and the limits on it. */
export const tenancyManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  displayName: "Tenancy and Organization Core",
  eventsProduced: [],
  internalDependencies: [],
  key: MODULES.coreTenancy,
  limitDimensions: [
    "core.business_units.active",
    "core.locations.active",
    "core.users.active",
    "core.roles.custom",
    "core.storage.gb",
  ],
  namespaces: ["core"],
  navigation: [],
  permissions: [PERMISSIONS.organizationRead, PERMISSIONS.organizationManage],
  routes: [],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS", "PERSONAL"],
  version: "1.0.0",
};
