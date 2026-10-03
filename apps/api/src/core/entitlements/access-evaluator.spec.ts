import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException, ForbiddenException } from "@nestjs/common";

import {
  ACCESS_DENIALS,
  accessDenied,
  evaluateAccess,
  type AccessDenialCode,
  type AccessFacts,
  type AccessRequirement,
} from "./access-evaluator.js";

/** Everything a request for the most demanding route needs, all satisfied. */
const allowed: AccessFacts = {
  allLocations: true,
  capabilities: new Set(["pos.split_bill"]),
  featureFlags: new Map([["pos.new_checkout", true]]),
  installation: "ACTIVE",
  limit: { limit: 3n, usage: 2n },
  location: { active: true, inScope: true },
  membershipActive: true,
  module: { entitled: true, tier: "PRO" },
  permissionKeys: ["order.create"],
  subscriptionUsable: true,
};
const requirement: AccessRequirement = {
  allLocations: true,
  capability: "pos.split_bill",
  featureFlag: "pos.new_checkout",
  limitDimension: "pos.registers",
  minimumTier: "PRO",
  moduleKey: "POS",
  permission: "order.create",
};

function codeOf(facts: Partial<AccessFacts>, needs: AccessRequirement = requirement) {
  const decision = evaluateAccess({ ...allowed, ...facts }, needs);
  return decision.allowed ? "ALLOWED" : decision.code;
}

test("allows a request that satisfies every step", () => {
  assert.deepEqual(evaluateAccess(allowed, requirement), { allowed: true });
});

// One test per reason a request can be refused (M2-SC-04).

test("refuses someone who is not an active member of the workspace", () => {
  assert.equal(codeOf({ membershipActive: false }), "WORKSPACE_ACCESS_DENIED");
});

test("refuses when the subscription cannot be used", () => {
  assert.equal(codeOf({ subscriptionUsable: false }), "SUBSCRIPTION_SUSPENDED");
});

test("refuses when the module is not installed and set up", () => {
  const decision = evaluateAccess({ ...allowed, installation: "SETUP_REQUIRED" }, requirement);
  assert.deepEqual(decision, {
    allowed: false,
    code: "INSTALLATION_SETUP_REQUIRED",
    details: { installation: "SETUP_REQUIRED", moduleKey: "POS" },
  });
});

test("refuses a module the subscription does not include", () => {
  assert.equal(codeOf({ module: { entitled: false, tier: null } }), "ENTITLEMENT_REQUIRED");
  const withoutModule: AccessFacts = { ...allowed };
  delete withoutModule.module;
  const decision = evaluateAccess(withoutModule, requirement);
  assert.equal(decision.allowed ? "ALLOWED" : decision.code, "ENTITLEMENT_REQUIRED");
});

test("refuses a capability the subscription does not include", () => {
  const decision = evaluateAccess({ ...allowed, capabilities: new Set() }, requirement);
  assert.deepEqual(decision, {
    allowed: false,
    code: "ENTITLEMENT_REQUIRED",
    details: { capability: "pos.split_bill" },
  });
});

test("refuses when the module's tier is too low", () => {
  const decision = evaluateAccess(
    { ...allowed, module: { entitled: true, tier: "BASIC" } },
    requirement,
  );
  assert.deepEqual(decision, {
    allowed: false,
    code: "TIER_UPGRADE_REQUIRED",
    details: { moduleKey: "POS", requiredTier: "PRO" },
  });
  assert.equal(codeOf({ module: { entitled: true, tier: "ADVANCED" } }), "ALLOWED");
});

test("refuses a user whose role lacks the permission", () => {
  assert.equal(codeOf({ permissionKeys: ["catalog.read"] }), "PERMISSION_DENIED");
});

test("refuses a location outside the user's scope, or one that is inactive", () => {
  assert.equal(codeOf({ location: { active: true, inScope: false } }), "LOCATION_SCOPE_DENIED");
  assert.equal(codeOf({ location: { active: false, inScope: true } }), "LOCATION_SCOPE_DENIED");
  assert.equal(codeOf({ allLocations: false }), "LOCATION_SCOPE_DENIED");
});

test("refuses a feature whose flag is not open", () => {
  assert.equal(
    codeOf({ featureFlags: new Map([["pos.new_checkout", false]]) }),
    "FEATURE_DISABLED",
  );
  assert.equal(codeOf({ featureFlags: new Map() }), "FEATURE_DISABLED");
});

test("refuses creating a resource once the limit is reached, with the numbers", () => {
  const decision = evaluateAccess({ ...allowed, limit: { limit: 3n, usage: 3n } }, requirement);
  assert.deepEqual(decision, {
    allowed: false,
    code: "LIMIT_REACHED",
    details: { dimensionKey: "pos.registers", limit: "3", usage: "3" },
  });
  assert.equal(codeOf({ limit: { limit: null, usage: 9_999n } }), "ALLOWED");
});

test("when several things fail, the most fundamental reason is reported", () => {
  const order: Array<[Partial<AccessFacts>, AccessDenialCode]> = [
    [{ membershipActive: false }, "WORKSPACE_ACCESS_DENIED"],
    [{ subscriptionUsable: false }, "SUBSCRIPTION_SUSPENDED"],
    [{ module: { entitled: false, tier: null } }, "ENTITLEMENT_REQUIRED"],
    [{ installation: "NOT_INSTALLED" }, "INSTALLATION_SETUP_REQUIRED"],
    [{ permissionKeys: [] }, "PERMISSION_DENIED"],
    [{ location: { active: true, inScope: false } }, "LOCATION_SCOPE_DENIED"],
    [{ featureFlags: new Map() }, "FEATURE_DISABLED"],
    [{ limit: { limit: 1n, usage: 1n } }, "LIMIT_REACHED"],
  ];
  // Break everything from step N onward: the answer must be step N's reason.
  for (let from = 0; from < order.length; from += 1) {
    const broken = Object.assign(
      {},
      ...order.slice(from).map(([facts]) => facts),
    ) as Partial<AccessFacts>;
    assert.equal(codeOf(broken), order[from]![1]);
  }
});

test("a requirement that is not stated is not checked", () => {
  const bare: AccessFacts = {
    allLocations: false,
    membershipActive: true,
    permissionKeys: [],
    subscriptionUsable: true,
  };
  assert.deepEqual(evaluateAccess(bare, {}), { allowed: true });
  // Installations are not tracked yet: a missing status does not block.
  assert.deepEqual(
    evaluateAccess({ ...bare, module: { entitled: true, tier: null } }, { moduleKey: "POS" }),
    { allowed: true },
  );
});

test("every reason maps to its own code and the documented status", () => {
  for (const code of Object.keys(ACCESS_DENIALS) as AccessDenialCode[]) {
    const error = accessDenied(code, { moduleKey: "POS" });
    const conflict = code === "INSTALLATION_SETUP_REQUIRED" || code === "LIMIT_REACHED";
    assert.ok(
      conflict ? error instanceof ConflictException : error instanceof ForbiddenException,
      code,
    );
    assert.deepEqual(error.getResponse(), {
      code,
      details: { moduleKey: "POS" },
      message: ACCESS_DENIALS[code].message,
    });
  }
});
