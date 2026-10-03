import type { ModuleAccessReason } from "@merchant/ui/module-access-state";

/** The part of an API error this decision needs. */
export type RefusedRequest = { code: string; details?: Record<string, unknown> | undefined };

const REASON_BY_CODE: Record<string, ModuleAccessReason> = {
  ENTITLEMENT_REQUIRED: "not-entitled",
  // A feature flag is closed for this user: nothing to buy, nothing to set up.
  FEATURE_DISABLED: "permission-denied",
  LOCATION_SCOPE_DENIED: "permission-denied",
  PERMISSION_DENIED: "permission-denied",
  SUBSCRIPTION_SUSPENDED: "subscription-suspended",
  TIER_UPGRADE_REQUIRED: "tier-required",
  WORKSPACE_ACCESS_DENIED: "permission-denied",
};

/**
 * Which access state an API refusal should be shown as, or undefined when the
 * error is not about access (then it is an ordinary error with a retry).
 */
export function accessReasonOf(error: RefusedRequest): ModuleAccessReason | undefined {
  if (error.code === "INSTALLATION_SETUP_REQUIRED") {
    const installation = error.details?.installation;
    if (installation === "PROVISIONING") return "provisioning";
    if (installation === "SUSPENDED" || installation === "ERROR") return "paused";
    // Not installed yet, or installed and waiting for setup.
    return "setup-required";
  }
  return REASON_BY_CODE[error.code];
}

/** Reasons that may clear up on their own, so offering "try again" makes sense. */
export function canRetry(reason: ModuleAccessReason) {
  return reason === "provisioning" || reason === "paused";
}
