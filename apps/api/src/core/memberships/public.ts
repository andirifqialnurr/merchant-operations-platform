// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { AccessModule } from "./access.module.js";
export { AccessService } from "./access.service.js";
export { ApprovalPinService } from "./approval-pin.service.js";
export type { Approver } from "./approval-pin.service.js";
export {
  CurrentAccess,
  RequireAllOutlets,
  RequireFeature,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
  type AccessRequirement,
} from "./session-permission.guard.js";
export { identityManifest } from "./manifest.js";
