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
  navigation: [
    {
      label: "Users",
      path: "/settings/users",
      permissionKey: PERMISSIONS.accessMembershipManage,
    },
    { label: "Roles", path: "/settings/roles", permissionKey: PERMISSIONS.accessRoleRead },
  ],
  permissions: [
    PERMISSIONS.accessRoleRead,
    PERMISSIONS.accessRoleManage,
    PERMISSIONS.accessMembershipManage,
  ],
  routes: [
    { path: "/settings/users", permissionKey: PERMISSIONS.accessMembershipManage },
    { path: "/settings/roles", permissionKey: PERMISSIONS.accessRoleRead },
  ],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS", "PERSONAL"],
  version: "1.0.0",
};
