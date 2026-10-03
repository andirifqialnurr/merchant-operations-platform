import type { ModuleInstallationStatus } from "@merchant/contracts";

/**
 * The installation lifecycle of architecture.md 6.1:
 *
 *   NOT_INSTALLED -> PROVISIONING -> SETUP_REQUIRED -> ACTIVE
 *                                        |              |
 *                                      ERROR <----- SUSPENDED
 *
 * Suspending and uninstalling never delete data; installing again goes back
 * through PROVISIONING on the same installation.
 */
const NEXT: Record<ModuleInstallationStatus, readonly ModuleInstallationStatus[]> = {
  ACTIVE: ["SUSPENDED", "ERROR", "NOT_INSTALLED"],
  // A failed installation is retried or given up.
  ERROR: ["PROVISIONING", "NOT_INSTALLED"],
  NOT_INSTALLED: ["PROVISIONING"],
  // A module without required setup steps becomes active straight away.
  PROVISIONING: ["SETUP_REQUIRED", "ACTIVE", "ERROR"],
  SETUP_REQUIRED: ["ACTIVE", "ERROR", "NOT_INSTALLED"],
  SUSPENDED: ["ACTIVE", "ERROR", "NOT_INSTALLED"],
};

export function canMove(from: ModuleInstallationStatus, to: ModuleInstallationStatus) {
  return NEXT[from].includes(to);
}

/** Statuses in which installing again changes nothing: the work is done or under way. */
export function isInstalled(status: ModuleInstallationStatus) {
  return status === "ACTIVE" || status === "SETUP_REQUIRED" || status === "PROVISIONING";
}
