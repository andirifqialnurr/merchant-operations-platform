// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { OrderIntakeService } from "./application/order-intake.service.js";
export { SELLABLE_MENU_SOURCE } from "./application/sellable-menu.port.js";
export type { SellableMenuSource } from "./application/sellable-menu.port.js";
export {
  TABLE_VISIT_SOURCE,
  type TableVisitSource,
} from "./application/table-visit-source.port.js";
export { OrderIntakeModule } from "./order-intake.module.js";
export { orderIntakeManifest } from "./manifest.js";
