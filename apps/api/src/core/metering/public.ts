// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { MeteringModule } from "./metering.module.js";
export { MeteringService, USAGE_GAUGE_REGISTRY, UsageGaugeRegistry } from "./metering.service.js";
export type { UsageGauge } from "./metering.service.js";
export { USAGE_DIMENSIONS, usageDimension } from "./usage-dimensions.js";
