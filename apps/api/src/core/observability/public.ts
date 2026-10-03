// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export {
  buildErrorTrackingEvent,
  createRequestObservabilityMiddleware,
  defaultStructuredLogger,
  getRequestId,
} from "./request-observability.js";
export type { StructuredLogger } from "./request-observability.js";
