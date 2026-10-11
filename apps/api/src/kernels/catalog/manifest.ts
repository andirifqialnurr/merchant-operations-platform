import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/**
 * Catalog. Capability keys and tiers come from
 * docs/product/CAFE-COMPANION-MODULE-TIERS-V1.md section 3.3.
 */
export const catalogManifest: ModuleManifest = {
  capabilities: [
    "catalog.profile.manage",
    "catalog.product.manage",
    "catalog.category.manage",
    "catalog.modifier.basic",
    "catalog.availability.manual",
    "catalog.public.read",
    "catalog.variant.manage",
    "catalog.price.by_location",
    "catalog.recipe.bind",
    "catalog.bundle.manage",
    "catalog.availability.schedule",
    "catalog.price.by_channel",
    "catalog.import.bulk",
    "catalog.price.rule",
    "catalog.workflow.approve",
    "catalog.version.manage",
    "catalog.brand.centralize",
  ],
  capabilityTiers: {
    "catalog.availability.schedule": "PRO",
    "catalog.brand.centralize": "ADVANCED",
    "catalog.bundle.manage": "PRO",
    "catalog.import.bulk": "PRO",
    "catalog.price.by_channel": "PRO",
    "catalog.price.rule": "ADVANCED",
    "catalog.version.manage": "ADVANCED",
    "catalog.workflow.approve": "ADVANCED",
  },
  displayName: "Catalog",
  eventsProduced: [],
  internalDependencies: [],
  key: MODULES.coreCatalog,
  limitDimensions: ["catalog.products.active"],
  namespaces: ["catalog"],
  navigation: [{ label: "Catalog", path: "/catalog", permissionKey: PERMISSIONS.catalogRead }],
  permissions: [PERMISSIONS.catalogRead, PERMISSIONS.catalogManage],
  routes: [{ path: "/catalog", permissionKey: PERMISSIONS.catalogRead }],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
