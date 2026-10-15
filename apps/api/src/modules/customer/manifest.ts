import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/**
 * Customer Basic. Capability keys and the tier each starts at come from
 * docs/product/CAFE-COMPANION-MODULE-TIERS-V1.md section 10.2; keys of a
 * higher tier are declared even while the feature behind them is not built.
 *
 * It reads orders and paid sales through the kernels' public services and
 * learns about sales from `sale.completed.v1`; nothing else knows about it.
 */
export const customerManifest: ModuleManifest = {
  capabilities: [
    "customer.profile.manage",
    "customer.history.read",
    "customer.report.basic",
    "customer.merge.manage",
    "customer.segment.manage",
    "customer.consent.manage",
    "customer.loyalty.manage",
    "customer.voucher.manage",
    "customer.feedback.manage",
    "customer.campaign.automate",
    "customer.identity.resolve",
    "customer.analytics.advanced",
  ],
  capabilityTiers: {
    "customer.analytics.advanced": "ADVANCED",
    "customer.campaign.automate": "ADVANCED",
    "customer.consent.manage": "PRO",
    "customer.feedback.manage": "PRO",
    "customer.identity.resolve": "ADVANCED",
    "customer.loyalty.manage": "PRO",
    "customer.merge.manage": "PRO",
    "customer.segment.manage": "PRO",
    "customer.voucher.manage": "PRO",
  },
  displayName: "Customer Basic",
  eventsProduced: [],
  internalDependencies: [MODULES.coreOrder, MODULES.coreBill],
  key: MODULES.customerBasic,
  limitDimensions: ["customer.profiles.active"],
  namespaces: ["customer"],
  navigation: [],
  permissions: [
    PERMISSIONS.customerView,
    PERMISSIONS.customerManage,
    PERMISSIONS.customerContactView,
  ],
  routes: [],
  configSchemaVersion: 1,
  eventHandlers: [{ eventType: "sale.completed.v1", handlerKey: "customer.record_visit" }],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
