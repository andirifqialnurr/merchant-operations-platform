// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { AccessModule } from "./access.module.js";
export { AccessService } from "./access.service.js";
export {
  CurrentAccess,
  RequireAllOutlets,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";
export { identityManifest } from "./manifest.js";
