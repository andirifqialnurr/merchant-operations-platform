import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { MODULES, PERMISSIONS, type AuthorizationContext } from "@merchant/contracts";
import { HttpException } from "@nestjs/common";

import type { AccessService } from "../../../core/memberships/public.js";
import type { EntitlementService } from "../../../core/entitlements/public.js";
import { InventoryMasterReadAuthorizer } from "./inventory-master-read-access.js";

type Access = Awaited<ReturnType<AccessService["describeAccess"]>>;
type Entitlement = Awaited<ReturnType<EntitlementService["describeAccess"]>>;

function fixture() {
  const member: AuthorizationContext = {
    tenantId: randomUUID(),
    userId: randomUUID(),
    membershipId: randomUUID(),
    allOutlets: false,
    outletIds: [randomUUID()],
    permissionKeys: [PERMISSIONS.inventoryReceive],
  };
  const state: { access: Access; entitlement: Entitlement; trace: string[] } = {
    access: { context: member, membershipActive: true },
    entitlement: {
      subscriptionUsable: true,
      module: { entitled: true, tier: "BASIC" },
      installation: "ACTIVE",
      capabilities: new Set(["inventory.item.manage"]),
      snapshot: { modules: [], subscription: null },
    },
    trace: [],
  };
  const authorizer = new InventoryMasterReadAuthorizer(
    {
      describeAccess: async (userId, tenantId) => {
        state.trace.push("membership");
        assert.equal(userId, member.userId);
        assert.equal(tenantId, member.tenantId);
        return state.access;
      },
    },
    {
      describeAccess: async (tenantId, moduleKey) => {
        state.trace.push("entitlement");
        assert.equal(tenantId, member.tenantId);
        assert.equal(moduleKey, MODULES.inventoryBasic);
        return state.entitlement;
      },
    },
  );
  return { member, state, authorizer };
}

async function denied(run: Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    const response = error.getResponse();
    assert.ok(typeof response === "object" && "code" in response);
    assert.equal(response.code, code);
    return true;
  });
}

test("shared definitions allow master managers or Inventory operational readers without all-outlet mutation rights", async () => {
  for (const permission of [
    PERMISSIONS.inventoryMasterManage,
    PERMISSIONS.inventoryReceive,
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryStocktake,
  ]) {
    const f = fixture();
    f.member.permissionKeys = [permission];
    assert.deepEqual(await f.authorizer.authorize(f.member), { tenantId: f.member.tenantId });
    assert.deepEqual(f.state.trace, ["membership", "entitlement"]);
  }
});

test("inactive or mismatched membership refuses before subscription lookup", async () => {
  for (const mismatch of ["missing", "inactive", "membership", "tenant", "user"]) {
    const f = fixture();
    if (mismatch === "missing") f.state.access.context = null;
    if (mismatch === "inactive") f.state.access.membershipActive = false;
    if (mismatch === "membership")
      f.state.access.context = { ...f.member, membershipId: randomUUID() };
    if (mismatch === "tenant") f.state.access.context = { ...f.member, tenantId: randomUUID() };
    if (mismatch === "user") f.state.access.context = { ...f.member, userId: randomUUID() };
    await denied(f.authorizer.authorize(f.member), "WORKSPACE_ACCESS_DENIED");
    assert.deepEqual(f.state.trace, ["membership"]);
  }
});

test("subscription, module, installation, capability and permission are all mandatory in that order", async () => {
  for (const reason of [
    "subscription",
    "module",
    "installation",
    "missing-installation",
    "capability",
    "permission",
  ] as const) {
    const f = fixture();
    f.member.permissionKeys = [];
    if (reason === "subscription") f.state.entitlement.subscriptionUsable = false;
    if (reason === "subscription" || reason === "module")
      f.state.entitlement.module = { entitled: false, tier: null };
    if (["subscription", "module", "installation"].includes(reason))
      f.state.entitlement.installation = "SUSPENDED";
    if (reason === "missing-installation") delete f.state.entitlement.installation;
    if (reason !== "permission") f.state.entitlement.capabilities = new Set();
    const code = {
      subscription: "SUBSCRIPTION_SUSPENDED",
      module: "ENTITLEMENT_REQUIRED",
      installation: "INSTALLATION_SETUP_REQUIRED",
      "missing-installation": "INSTALLATION_SETUP_REQUIRED",
      capability: "ENTITLEMENT_REQUIRED",
      permission: "PERMISSION_DENIED",
    }[reason];
    await denied(f.authorizer.authorize(f.member), code);
  }
});

test("master queries never cache supplied roles, membership or entitlement across pages", async () => {
  const f = fixture();
  const stale = { ...f.member, permissionKeys: [...f.member.permissionKeys] };
  await f.authorizer.authorize(stale);
  f.member.permissionKeys = [PERMISSIONS.orderCreate, PERMISSIONS.organizationManage];
  await denied(f.authorizer.authorize(stale), "PERMISSION_DENIED");
  f.member.permissionKeys = [PERMISSIONS.inventoryReceive];
  f.state.entitlement.capabilities.clear();
  await denied(f.authorizer.authorize(stale), "ENTITLEMENT_REQUIRED");
  f.state.access = { context: null, membershipActive: false };
  await denied(f.authorizer.authorize(stale), "WORKSPACE_ACCESS_DENIED");
  assert.equal(f.state.trace.filter((key) => key === "membership").length, 4);
});

test("device sessions cannot read Backoffice master definitions even with Inventory permissions", async () => {
  const f = fixture();
  await denied(
    f.authorizer.authorize({ ...f.member, deviceId: randomUUID() }),
    "LOCATION_SCOPE_DENIED",
  );
});
