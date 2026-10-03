// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { EntitlementModule } from "./entitlement.module.js";
export { EntitlementService } from "./entitlement.service.js";
export { accessDenied, assertAccess, evaluateAccess } from "./access-evaluator.js";
export type {
  AccessDecision,
  AccessDenialCode,
  AccessFacts,
  AccessRequirement,
} from "./access-evaluator.js";
export { subscriptionManifest } from "./manifest.js";
