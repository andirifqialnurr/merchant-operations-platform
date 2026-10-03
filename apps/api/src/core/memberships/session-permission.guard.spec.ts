import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { API_HEADERS, MODULES, PERMISSIONS, type AuthorizationContext } from "@merchant/contracts";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthService } from "../auth/auth.service.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { AccessDescription, AccessService } from "./access.service.js";
import {
  RequireAllOutlets,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";

const IDS = {
  membership: "019f738d-e61f-7d46-92de-17b35f973001",
  outlet: "019f738d-e61f-7d46-92de-17b35f973002",
  otherOutlet: "019f738d-e61f-7d46-92de-17b35f973003",
  tenant: "019f738d-e61f-7d46-92de-17b35f973004",
  user: "019f738d-e61f-7d46-92de-17b35f973005",
} as const;

const member: AuthorizationContext = {
  allOutlets: false,
  membershipId: IDS.membership,
  outletIds: [IDS.outlet],
  permissionKeys: [PERMISSIONS.orderCreate],
  tenantId: IDS.tenant,
  userId: IDS.user,
};

/** A route like the cashier's: needs the POS module and the order permission. */
@RequireModule(MODULES.pos)
class Routes {
  @RequirePermission(PERMISSIONS.orderCreate)
  sell() {}

  @RequirePermission(PERMISSIONS.orderCreate)
  @RequireAllOutlets()
  sellEverywhere() {}

  @RequirePermission(PERMISSIONS.paymentRefund)
  refund() {}
}

type World = {
  access?: AccessDescription;
  entitled?: boolean;
  subscriptionUsable?: boolean;
};

function run(world: World, handler: keyof Routes = "sell", outletId: string = IDS.outlet) {
  let entitlementLookups = 0;
  const guard = new SessionPermissionGuard(
    {
      getSession: async () => ({ expiresAt: "2026-12-01T00:00:00.000Z", user: { id: IDS.user } }),
    } as unknown as AuthService,
    {
      describeAccess: async (_user: string, _tenant: string, requested?: string) =>
        world.access ?? {
          context: member,
          location: { active: true, inScope: member.outletIds.includes(requested ?? "") },
          membershipActive: true,
        },
    } as unknown as AccessService,
    {
      describeAccess: async () => {
        entitlementLookups += 1;
        return {
          module: { entitled: world.entitled ?? true, tier: null },
          subscriptionUsable: world.subscriptionUsable ?? true,
        };
      },
    } as unknown as EntitlementService,
    new Reflector(),
  );
  const request: { accessContext?: AuthorizationContext; headers: Record<string, string> } = {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(43)}`,
      [API_HEADERS.outletId]: outletId,
      [API_HEADERS.tenantId]: IDS.tenant,
    },
  };
  const context = {
    getClass: () => Routes,
    getHandler: () => Routes.prototype[handler],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return {
    entitlementLookups: () => entitlementLookups,
    request,
    result: guard.canActivate(context),
  };
}

async function refusal(result: Promise<boolean>) {
  try {
    await result;
  } catch (error) {
    assert.ok(error instanceof HttpException);
    const body = error.getResponse() as { code: string };
    return { code: body.code, status: error.getStatus() };
  }
  return { code: "ALLOWED", status: 200 };
}

test("lets a member with the module, the permission, and the location through", async () => {
  const attempt = run({});
  assert.equal(await attempt.result, true);
  assert.deepEqual(attempt.request.accessContext, member);
});

test("a non-member is refused before the workspace's subscription is even read", async () => {
  const attempt = run({ access: { context: null, membershipActive: false } });
  assert.deepEqual(await refusal(attempt.result), { code: "WORKSPACE_ACCESS_DENIED", status: 403 });
  assert.equal(attempt.entitlementLookups(), 0);
});

test("a suspended subscription is reported as such, not as a missing permission", async () => {
  const attempt = run({ subscriptionUsable: false }, "refund");
  assert.deepEqual(await refusal(attempt.result), { code: "SUBSCRIPTION_SUSPENDED", status: 403 });
});

test("a module outside the subscription is reported before the permission", async () => {
  const attempt = run({ entitled: false }, "refund");
  assert.deepEqual(await refusal(attempt.result), { code: "ENTITLEMENT_REQUIRED", status: 403 });
});

test("a role without the permission is refused with PERMISSION_DENIED", async () => {
  const attempt = run({}, "refund");
  assert.deepEqual(await refusal(attempt.result), { code: "PERMISSION_DENIED", status: 403 });
  assert.equal(attempt.request.accessContext, undefined);
});

test("a location outside the assignment is refused with LOCATION_SCOPE_DENIED", async () => {
  const elsewhere = run({}, "sell", IDS.otherOutlet);
  assert.deepEqual(await refusal(elsewhere.result), { code: "LOCATION_SCOPE_DENIED", status: 403 });

  const workspaceWide = run({}, "sellEverywhere");
  assert.deepEqual(await refusal(workspaceWide.result), {
    code: "LOCATION_SCOPE_DENIED",
    status: 403,
  });
});
