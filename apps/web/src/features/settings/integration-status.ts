import type { IntegrationBinding } from "@merchant/contracts";

/** What an integration is doing, in the few words a business owner needs. */
export type IntegrationState = "ACTIVE" | "FAILED" | "PAUSED" | "PROCESSING" | "SETUP_REQUIRED";

/**
 * Folds the status of a binding and the health of its deliveries into one
 * state. An integration of a module that is no longer used has none: it is
 * left out of the list.
 */
export function integrationState(
  binding: Pick<IntegrationBinding, "health" | "status">,
): IntegrationState | undefined {
  switch (binding.status) {
    case "DISABLED":
      return undefined;
    case "DRAFT":
    case "SETUP_REQUIRED":
      return "SETUP_REQUIRED";
    case "PAUSED":
      return "PAUSED";
    case "ERROR":
      return "FAILED";
    case "ACTIVE":
      // Deliveries are held although the integration is on: that is a failure to the owner.
      if (binding.health === "BLOCKED") return "FAILED";
      // Asked to try again; the worker has not finished yet.
      return binding.health === "STALE" ? "PROCESSING" : "ACTIVE";
  }
}

/** Trying again makes sense only when something was held back. */
export function canRetryIntegration(state: IntegrationState) {
  return state === "FAILED";
}
