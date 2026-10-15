import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/**
 * Tables and self-order. Capability keys and the tier each starts at come
 * from docs/product/CAFE-COMPANION-MODULE-TIERS-V1.md section 5.3; keys of a
 * higher tier are declared even while the feature behind them is not built.
 */
export const floorManifest: ModuleManifest = {
  capabilities: [
    "floor.table.manage",
    "floor.structure.manage",
    "floor.layout.basic",
    "floor.table_session.manage",
    "floor.table_session.move",
    "floor.qr.generate",
    "floor.qr.rotate",
    "self_order.menu.read",
    "self_order.order.submit",
    "self_order.status.read",
    "self_order.reorder",
    "self_order.waiter_call",
    "self_order.payment_request",
    "floor.layout.advanced",
    "floor.service_zone.manage",
    "floor.table_session.merge_split",
    "floor.qr.session",
    "self_order.policy.auto_accept",
    "self_order.group_order",
    "self_order.brand.custom",
    "floor.reservation.optimize",
  ],
  capabilityTiers: {
    "floor.layout.advanced": "PRO",
    "floor.qr.session": "PRO",
    "floor.reservation.optimize": "ADVANCED",
    "floor.service_zone.manage": "PRO",
    "floor.table_session.merge_split": "PRO",
    "self_order.brand.custom": "ADVANCED",
    "self_order.group_order": "PRO",
    "self_order.policy.auto_accept": "PRO",
  },
  displayName: "Tables and Self-Order",
  eventsProduced: ["table_session.opened.v1", "table_session.closed.v1"],
  internalDependencies: [],
  key: MODULES.tableSelfOrder,
  limitDimensions: [
    "floor.floors.active_per_location",
    "floor.areas.active_per_floor",
    "floor.tables.active_per_location",
    "self_order.orders.submitted.cycle",
  ],
  namespaces: ["floor", "self_order"],
  navigation: [
    { label: "Tables", path: "/floor", permissionKey: PERMISSIONS.tableLayoutManage },
    // The cashier's screen; shown in the POS bar, not in the backoffice menu.
    { label: "Tables at the cashier", path: "/pos/tables", permissionKey: PERMISSIONS.tableView },
  ],
  permissions: [
    PERMISSIONS.tableView,
    PERMISSIONS.tableManage,
    PERMISSIONS.tableLayoutManage,
    PERMISSIONS.tableQrManage,
  ],
  routes: [
    { path: "/floor", permissionKey: PERMISSIONS.tableLayoutManage },
    { path: "/pos/tables", permissionKey: PERMISSIONS.tableView },
  ],
  configSchemaVersion: 1,
  eventHandlers: [],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
