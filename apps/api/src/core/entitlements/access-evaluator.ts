import { ConflictException, ForbiddenException, type HttpException } from "@nestjs/common";

/**
 * Why a request is refused. Every reason has its own code so the client can
 * show the right state (upgrade, ask the owner, finish setup) instead of one
 * generic "no access" (architecture.md 6.3, backend.md 9).
 */
export const ACCESS_DENIALS = {
  /** Not an active member of this workspace. */
  WORKSPACE_ACCESS_DENIED: {
    message: "You are not an active member of this workspace.",
    status: 403,
  },
  SUBSCRIPTION_SUSPENDED: { message: "This workspace's subscription cannot be used.", status: 403 },
  INSTALLATION_SETUP_REQUIRED: {
    message: "This module is not installed and set up yet.",
    status: 409,
  },
  ENTITLEMENT_REQUIRED: {
    message: "The subscription does not include this module or capability.",
    status: 403,
  },
  TIER_UPGRADE_REQUIRED: { message: "This needs a higher tier of the module.", status: 403 },
  PERMISSION_DENIED: { message: "Your role does not allow this action.", status: 403 },
  LOCATION_SCOPE_DENIED: { message: "This location is outside your assignment.", status: 403 },
  FEATURE_DISABLED: { message: "This feature is not switched on.", status: 403 },
  LIMIT_REACHED: { message: "The limit for this resource has been reached.", status: 409 },
} as const;

export type AccessDenialCode = keyof typeof ACCESS_DENIALS;
export type ModuleTier = "BASIC" | "PRO" | "ADVANCED";
export type InstallationStatus =
  "ACTIVE" | "ERROR" | "NOT_INSTALLED" | "PROVISIONING" | "SETUP_REQUIRED" | "SUSPENDED";

const TIER_RANK: Record<ModuleTier, number> = { ADVANCED: 3, BASIC: 1, PRO: 2 };

/** What the route needs. Anything left out is not checked. */
export type AccessRequirement = {
  /** The user must be assigned to every location of the workspace. */
  allLocations?: boolean;
  capability?: string;
  featureFlag?: string;
  /** Checked only when a resource is being created. */
  limitDimension?: string;
  minimumTier?: ModuleTier;
  moduleKey?: string;
  permission?: string;
};

/** What is true for this user, workspace, and location right now. */
export type AccessFacts = {
  allLocations: boolean;
  capabilities?: ReadonlySet<string>;
  featureFlags?: ReadonlyMap<string, boolean>;
  /** Left out while installations are not tracked; then the step is skipped. */
  installation?: InstallationStatus;
  /** A null limit means unlimited. */
  limit?: { limit: bigint | null; usage: bigint };
  /** Present when the request names a location. */
  location?: { active: boolean; inScope: boolean };
  membershipActive: boolean;
  /** Present when the route requires a module. */
  module?: { entitled: boolean; tier: ModuleTier | null };
  permissionKeys: readonly string[];
  subscriptionUsable: boolean;
};

export type AccessDecision =
  { allowed: true } | { allowed: false; code: AccessDenialCode; details?: Record<string, string> };

const deny = (code: AccessDenialCode, details?: Record<string, string>): AccessDecision => ({
  allowed: false,
  code,
  ...(details ? { details } : {}),
});

/**
 * Decides access in the fixed order of architecture.md 6.3 and stops at the
 * first failure, so the reason is always the most fundamental one. (Step 1,
 * a valid session, is settled before any facts can be gathered.)
 */
export function evaluateAccess(facts: AccessFacts, requirement: AccessRequirement): AccessDecision {
  // 2. Active membership in the workspace.
  if (!facts.membershipActive) return deny("WORKSPACE_ACCESS_DENIED");

  // 3. The workspace's subscription can be used.
  if (!facts.subscriptionUsable) return deny("SUBSCRIPTION_SUSPENDED");

  if (requirement.moduleKey) {
    // 4. The module is part of what the workspace bought, and it is installed
    // and set up. Ownership is checked first: a module nobody bought cannot be
    // installed, so "not installed" would be the wrong thing to say.
    if (!facts.module?.entitled) {
      return deny("ENTITLEMENT_REQUIRED", { moduleKey: requirement.moduleKey });
    }
    if (facts.installation && facts.installation !== "ACTIVE") {
      return deny("INSTALLATION_SETUP_REQUIRED", {
        installation: facts.installation,
        moduleKey: requirement.moduleKey,
      });
    }

    // 5. The tier and the capability are entitled.
    if (requirement.minimumTier) {
      const tier = facts.module.tier;
      if (!tier || TIER_RANK[tier] < TIER_RANK[requirement.minimumTier]) {
        return deny("TIER_UPGRADE_REQUIRED", {
          moduleKey: requirement.moduleKey,
          requiredTier: requirement.minimumTier,
        });
      }
    }
  }
  if (requirement.capability && !facts.capabilities?.has(requirement.capability)) {
    return deny("ENTITLEMENT_REQUIRED", { capability: requirement.capability });
  }

  // 6. The user's role allows the action.
  if (requirement.permission && !facts.permissionKeys.includes(requirement.permission)) {
    return deny("PERMISSION_DENIED");
  }

  // 7. The location is within the user's scope.
  if (facts.location && !(facts.location.active && facts.location.inScope)) {
    return deny("LOCATION_SCOPE_DENIED");
  }
  if (requirement.allLocations && !facts.allLocations) return deny("LOCATION_SCOPE_DENIED");

  // 8. The feature flag is open.
  if (requirement.featureFlag && facts.featureFlags?.get(requirement.featureFlag) !== true) {
    return deny("FEATURE_DISABLED", { featureFlag: requirement.featureFlag });
  }

  // 9. The limit, only when a resource is being created.
  if (requirement.limitDimension && facts.limit && facts.limit.limit !== null) {
    if (facts.limit.usage >= facts.limit.limit) {
      return deny("LIMIT_REACHED", {
        dimensionKey: requirement.limitDimension,
        limit: facts.limit.limit.toString(),
        usage: facts.limit.usage.toString(),
      });
    }
  }

  return { allowed: true };
}

/** The HTTP error for a refusal: the stable code, a neutral message, and parameters. */
export function accessDenied(
  code: AccessDenialCode,
  details?: Record<string, string>,
): HttpException {
  const { message, status } = ACCESS_DENIALS[code];
  const body = { code, message, ...(details ? { details } : {}) };
  return status === 409 ? new ConflictException(body) : new ForbiddenException(body);
}

/** Throws when the decision is a refusal. */
export function assertAccess(decision: AccessDecision): void {
  if (!decision.allowed) throw accessDenied(decision.code, decision.details);
}
