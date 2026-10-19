// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { TableVisitGuard } from "./application/table-visit-guard.js";
export { TableSessions } from "./application/table-sessions.js";
export { FloorModule } from "./floor.module.js";
export { floorManifest } from "./manifest.js";
