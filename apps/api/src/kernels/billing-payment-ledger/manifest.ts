import { MODULES, type ModuleManifest } from "@merchant/contracts";

const shared = {
  capabilities: [],
  capabilityTiers: {},
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
} satisfies Partial<ModuleManifest>;

/** Bill kernel: what is owed for an order, and the sale once it is settled. */
export const billManifest: ModuleManifest = {
  ...shared,
  displayName: "Bill Core",
  eventsProduced: ["sale.completed.v1", "sale.refunded.v1"],
  internalDependencies: [MODULES.coreOrder],
  key: MODULES.coreBill,
};

/** Payment ledger kernel: money received and returned. */
export const paymentLedgerManifest: ModuleManifest = {
  ...shared,
  displayName: "Payment Ledger Core",
  eventsProduced: ["payment.recorded.v1"],
  internalDependencies: [MODULES.coreBill],
  key: MODULES.corePaymentLedger,
};
