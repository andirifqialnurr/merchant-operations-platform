import type { PermissionKey } from "@merchant/contracts";

import { accessDenied } from "../entitlements/public.js";

/**
 * Nobody hands out a permission they do not hold themselves. Without this, a
 * person who may edit roles could give any role, and through it themselves,
 * every permission there is.
 */
export function assertCanGrant(
  held: readonly PermissionKey[],
  requested: readonly PermissionKey[] | undefined,
) {
  if (requested?.some((permission) => !held.includes(permission))) {
    throw accessDenied("PERMISSION_DENIED");
  }
}
