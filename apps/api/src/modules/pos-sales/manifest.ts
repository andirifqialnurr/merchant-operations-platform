import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/**
 * POS and Sales. Capability keys and the tier each starts at come from
 * docs/product/CAFE-COMPANION-MODULE-TIERS-V1.md section 4.3; keys of a higher
 * tier are declared even while the feature behind them is not built.
 */
export const posSalesManifest: ModuleManifest = {
  capabilities: [
    "pos.order.create",
    "pos.order.cancel",
    "pos.bill.hold",
    "pos.payment.manual",
    "pos.payment.mixed",
    "pos.receipt.print",
    "pos.shift.manage",
    "pos.discount.basic",
    "pos.refund.simple",
    "pos.approval.manager",
    "pos.report.basic",
    "pos.bill.split",
    "pos.payment.split",
    "pos.refund.partial",
    "pos.approval.manage",
    "pos.shift.blind_close",
    "pos.webhook.outbound",
    "pos.policy.central",
    "pos.offline.advanced",
    "pos.integration.custom",
    "pos.payment.integrated",
  ],
  capabilityTiers: {
    "pos.approval.manage": "PRO",
    "pos.bill.split": "PRO",
    "pos.integration.custom": "ADVANCED",
    "pos.offline.advanced": "ADVANCED",
    "pos.payment.integrated": "ADVANCED",
    "pos.payment.split": "PRO",
    "pos.policy.central": "ADVANCED",
    "pos.refund.partial": "PRO",
    "pos.shift.blind_close": "PRO",
    "pos.webhook.outbound": "PRO",
  },
  displayName: "POS and Sales",
  // Orders, bills, and payments are produced by the kernels the cashier drives.
  eventsProduced: [],
  internalDependencies: [
    MODULES.coreCatalog,
    MODULES.coreOrder,
    MODULES.coreBill,
    MODULES.corePaymentLedger,
  ],
  key: MODULES.pos,
  limitDimensions: ["pos.registers.active", "pos.sales.completed.cycle"],
  namespaces: ["pos"],
  navigation: [{ label: "Cashier", path: "/pos", permissionKey: PERMISSIONS.orderCreate }],
  permissions: [
    PERMISSIONS.orderCreate,
    PERMISSIONS.orderCancel,
    PERMISSIONS.paymentConfirm,
    PERMISSIONS.paymentRefund,
    PERMISSIONS.shiftOpen,
    PERMISSIONS.shiftClose,
    PERMISSIONS.cashVarianceApprove,
  ],
  routes: [
    { path: "/pos", permissionKey: PERMISSIONS.orderCreate },
    { path: "/pos/orders", permissionKey: PERMISSIONS.orderCreate },
    { path: "/pos/shift", permissionKey: PERMISSIONS.shiftOpen },
  ],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
