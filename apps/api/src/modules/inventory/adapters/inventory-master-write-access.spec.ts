import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MODULES, PERMISSIONS, type AuthorizationContext } from "@merchant/contracts";
import { HttpException } from "@nestjs/common";
import type { AccessService } from "../../../core/memberships/public.js";
import type { EntitlementService } from "../../../core/entitlements/public.js";
import { DEFAULT_ROLE_DEFINITIONS } from "../../../core/memberships/access.service.js";
import { InventoryMasterWriteAuthorizer } from "./inventory-master-write-access.js";

type Access = Awaited<ReturnType<AccessService["describeAccess"]>>;
type Entitlement = Awaited<ReturnType<EntitlementService["describeAccess"]>>;
function fixture() {
  const member: AuthorizationContext = {
    tenantId: randomUUID(),
    userId: randomUUID(),
    membershipId: randomUUID(),
    allOutlets: true,
    outletIds: [],
    permissionKeys: [PERMISSIONS.inventoryMasterManage],
  };
  const state: { access: Access; entitlement: Entitlement; trace: string[] } = {
    access: { context: member, membershipActive: true },
    entitlement: {
      module: { entitled: true, tier: "BASIC" },
      installation: "ACTIVE",
      subscriptionUsable: true,
      capabilities: new Set(["inventory.item.manage"]),
      snapshot: { modules: [], subscription: null },
    },
    trace: [],
  };
  const authorizer = new InventoryMasterWriteAuthorizer(
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
async function denied(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    const response = error.getResponse();
    assert.ok(typeof response === "object" && "code" in response);
    assert.equal(response.code, code);
    return true;
  });
}

test("master mutations need their own permission; default roles grant it only to Owner/Manager", async () => {
  for (const role of DEFAULT_ROLE_DEFINITIONS)
    assert.equal(
      role.permissionKeys.includes(PERMISSIONS.inventoryMasterManage),
      ["OWNER", "MANAGER"].includes(role.code),
      role.code,
    );
  const f = fixture();
  assert.deepEqual(await f.authorizer.authorize(f.member), {
    tenantId: f.member.tenantId,
    actorId: f.member.userId,
  });
  f.member.permissionKeys = [
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryReceive,
    PERMISSIONS.inventoryStocktake,
    PERMISSIONS.organizationManage,
  ];
  await denied(f.authorizer.authorize(f.member), "PERMISSION_DENIED");
});

test("workspace scope and Backoffice session are required even for a master manager", async () => {
  const f = fixture();
  const stale = { ...f.member };
  f.member.allOutlets = false;
  f.member.outletIds = [randomUUID()];
  await denied(f.authorizer.authorize(stale), "LOCATION_SCOPE_DENIED");
  f.member.allOutlets = true;
  await denied(
    f.authorizer.authorize({ ...stale, deviceId: randomUUID() }),
    "LOCATION_SCOPE_DENIED",
  );
});

test("inactive or mismatched membership refuses before entitlement lookup", async () => {
  for (const mismatch of ["inactive", "missing", "membership", "tenant", "user"]) {
    const f = fixture();
    if (mismatch === "inactive") f.state.access.membershipActive = false;
    if (mismatch === "missing") f.state.access.context = null;
    if (mismatch === "membership")
      f.state.access.context = { ...f.member, membershipId: randomUUID() };
    if (mismatch === "tenant") f.state.access.context = { ...f.member, tenantId: randomUUID() };
    if (mismatch === "user") f.state.access.context = { ...f.member, userId: randomUUID() };
    await denied(f.authorizer.authorize(f.member), "WORKSPACE_ACCESS_DENIED");
    assert.deepEqual(f.state.trace, ["membership"]);
  }
});

test("subscription, module, installation, capability, permission and scope refuse in order", async () => {
  for (const reason of [
    "subscription",
    "module",
    "installation",
    "missing-installation",
    "capability",
    "permission",
    "scope",
  ]) {
    const f = fixture();
    f.member.allOutlets = false;
    if (reason !== "scope") f.member.permissionKeys = [];
    if (reason === "subscription") f.state.entitlement.subscriptionUsable = false;
    if (["subscription", "module"].includes(reason))
      f.state.entitlement.module = { entitled: false, tier: null };
    if (["subscription", "module", "installation"].includes(reason))
      f.state.entitlement.installation = "SUSPENDED";
    if (reason === "missing-installation") delete f.state.entitlement.installation;
    if (!["scope", "permission"].includes(reason)) f.state.entitlement.capabilities.clear();
    const code =
      reason === "subscription"
        ? "SUBSCRIPTION_SUSPENDED"
        : ["module", "capability"].includes(reason)
          ? "ENTITLEMENT_REQUIRED"
          : ["installation", "missing-installation"].includes(reason)
            ? "INSTALLATION_SETUP_REQUIRED"
            : reason === "permission"
              ? "PERMISSION_DENIED"
              : "LOCATION_SCOPE_DENIED";
    await denied(f.authorizer.authorize(f.member), code);
  }
});

test("stale context cannot retain revoked permission or membership on a replay", async () => {
  const f = fixture();
  const stale = { ...f.member };
  await f.authorizer.authorize(stale);
  f.member.permissionKeys = [];
  await denied(f.authorizer.authorize(stale), "PERMISSION_DENIED");
  f.state.access = { context: null, membershipActive: false };
  await denied(f.authorizer.authorize(stale), "WORKSPACE_ACCESS_DENIED");
  assert.equal(f.state.trace.filter((value) => value === "membership").length, 3);
});
