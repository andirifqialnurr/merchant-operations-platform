// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { buildAuditMetadata, buildAuditPayload } from "./critical-action-audit.js";
