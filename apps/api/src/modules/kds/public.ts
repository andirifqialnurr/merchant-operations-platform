// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { CreateKitchenTicket } from "./application/create-kitchen-ticket.js";
export { KITCHEN_ORDER_SOURCE } from "./application/kitchen-order-source.port.js";
export type { KitchenOrder, KitchenOrderSource } from "./application/kitchen-order-source.port.js";
export { KdsModule } from "./kds.module.js";
export { kdsManifest } from "./manifest.js";
