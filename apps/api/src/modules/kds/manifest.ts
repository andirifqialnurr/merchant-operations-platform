import { MODULES, PERMISSIONS, type ModuleManifest } from "@merchant/contracts";

/**
 * Kitchen Display System. Capability keys and the tier each starts at come
 * from docs/product/CAFE-COMPANION-MODULE-TIERS-V1.md section 6.3; keys of a
 * higher tier are declared even while the feature behind them is not built.
 *
 * It depends on no other module: a business can buy the kitchen screen alone
 * and feed it by hand. The permission `kds.ticket.manage` and the capability
 * of the same name are different things: one is what a person may do, the
 * other what the package includes.
 */
export const kdsManifest: ModuleManifest = {
  capabilities: [
    "kds.ticket.manage",
    "kds.intake.internal",
    "kds.intake.manual",
    "kds.intake.api_lite",
    "kds.alert.basic",
    "kds.report.basic",
    "kds.intake.api",
    "kds.station.manage",
    "kds.routing.rule",
    "kds.ticket.item_status",
    "kds.sla.manage",
    "kds.expo.display",
    "kds.print.fallback",
    "kds.course.manage",
    "kds.routing.dynamic",
    "kds.integration.custom",
  ],
  capabilityTiers: {
    "kds.course.manage": "ADVANCED",
    "kds.expo.display": "PRO",
    "kds.intake.api": "PRO",
    "kds.integration.custom": "ADVANCED",
    "kds.print.fallback": "PRO",
    "kds.routing.dynamic": "ADVANCED",
    "kds.routing.rule": "PRO",
    "kds.sla.manage": "PRO",
    "kds.station.manage": "PRO",
    "kds.ticket.item_status": "PRO",
  },
  displayName: "Kitchen Display System",
  eventsProduced: [
    "kitchen_ticket.started.v1",
    "kitchen_ticket.ready.v1",
    "kitchen_ticket.served.v1",
  ],
  internalDependencies: [],
  key: MODULES.kds,
  limitDimensions: [
    "kds.devices.active",
    "kds.stations.active_per_location",
    "kds.tickets.created.cycle",
  ],
  namespaces: ["kds"],
  navigation: [{ label: "Kitchen", path: "/kds", permissionKey: PERMISSIONS.kdsTicketView }],
  permissions: [PERMISSIONS.kdsTicketView, PERMISSIONS.kdsTicketManage],
  routes: [{ path: "/kds", permissionKey: PERMISSIONS.kdsTicketView }],
  configSchemaVersion: 1,
  eventHandlers: [
    { eventType: "order.submitted.v1", handlerKey: "kds.create_ticket" },
    { eventType: "order.canceled.v1", handlerKey: "kds.cancel_ticket" },
  ],
  installSteps: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};
