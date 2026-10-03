import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/** Users, roles, and memberships. */
export const identityManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  displayName: "Identity and Authorization Core",
  eventsProduced: [],
  internalDependencies: [MODULES.coreTenancy],
  key: MODULES.coreIdentity,
  limitDimensions: [],
  namespaces: [],
  navigation: [],
  permissions: [
    PERMISSIONS.accessRoleRead,
    PERMISSIONS.accessRoleManage,
    PERMISSIONS.accessMembershipManage,
  ],
  routes: [],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS", "PERSONAL"],
  version: "1.0.0",
};
