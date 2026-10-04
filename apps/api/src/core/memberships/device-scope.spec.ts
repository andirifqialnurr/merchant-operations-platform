import assert from "node:assert/strict";
import test from "node:test";

import {
  API_HEADERS,
  PERMISSIONS,
  type AuthorizationContext,
  type Device,
  type WorkspaceContext,
} from "@merchant/contracts";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { commandOriginFromRequest, eventOrigin } from "../../shared/command/command-origin.js";
import type { AuthService } from "../auth/public.js";
import type { EntitlementService } from "../entitlements/public.js";
import type { AccessService } from "./access.service.js";
import { scopeWorkspacesToDevice } from "./device-scope.js";
import {
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";

const IDS = {
  device: "019f738d-e61f-7d46-92de-17b35f978001",
  otherOutlet: "019f738d-e61f-7d46-92de-17b35f978002",
  otherTenant: "019f738d-e61f-7d46-92de-17b35f978003",
  outlet: "019f738d-e61f-7d46-92de-17b35f978004",
  tenant: "019f738d-e61f-7d46-92de-17b35f978005",
  user: "019f738d-e61f-7d46-92de-17b35f978006",
};

const device: Device = {
  activatedAt: "2026-10-01T00:00:00.000Z",
  activationExpiresAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  id: IDS.device,
  label: "Kasir depan",
  lastSeenAt: null,
  mode: "POS",
  outletId: IDS.outlet,
  revokedAt: null,
  status: "ACTIVE",
  workspaceId: IDS.tenant,
};

const owner: AuthorizationContext = {
  allOutlets: true,
  membershipId: "019f738d-e61f-7d46-92de-17b35f978007",
  outletIds: [IDS.outlet, IDS.otherOutlet],
  permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.catalogRead],
  tenantId: IDS.tenant,
  userId: IDS.user,
};

class Routes {
  @RequirePermission(PERMISSIONS.orderCreate)
  sell() {}

  @RequirePermission(PERMISSIONS.catalogRead)
  @RequireAllOutlets()
  wholeCatalog() {}
}

function request(
  surface: "BACKOFFICE" | "POS",
  options: { handler?: keyof Routes; outletId?: string; tenantId?: string } = {},
) {
  const guard = new SessionPermissionGuard(
    {
      getSession: async () => ({
        expiresAt: "2026-12-01T00:00:00.000Z",
        surface,
        user: { id: IDS.user },
      }),
    } as unknown as AuthService,
    {
      describeAccess: async () => ({
        context: owner,
        location: { active: true, inScope: true },
        membershipActive: true,
      }),
    } as unknown as AccessService,
    {
      describeAccess: async () => ({
        module: { entitled: true, tier: null },
        subscriptionUsable: true,
      }),
    } as unknown as EntitlementService,
    new Reflector(),
    { authenticate: async () => device },
  );
  const incoming: { accessContext?: AuthorizationContext; headers: Record<string, string> } = {
    headers: {
      ...(options.outletId ? { [API_HEADERS.outletId]: options.outletId } : {}),
      [API_HEADERS.tenantId]: options.tenantId ?? IDS.tenant,
    },
  };
  const context = {
    getClass: () => Routes,
    getHandler: () => Routes.prototype[options.handler ?? "sell"],
    switchToHttp: () => ({ getRequest: () => incoming }),
  } as unknown as ExecutionContext;
  return { incoming, result: guard.canActivate(context) };
}

async function outcome(result: Promise<boolean>) {
  try {
    await result;
    return "ALLOWED";
  } catch (error) {
    assert.ok(error instanceof HttpException);
    return (error.getResponse() as { code: string }).code;
  }
}

test("a session on a device works at the device's outlet and carries the device", async () => {
  const { incoming, result } = request("POS", { outletId: IDS.outlet });
  assert.equal(await outcome(result), "ALLOWED");
  assert.equal(incoming.accessContext?.deviceId, IDS.device);
});

test("a session on a device is refused at another outlet or another workspace", async () => {
  assert.equal(
    await outcome(request("POS", { outletId: IDS.otherOutlet }).result),
    "LOCATION_SCOPE_DENIED",
  );
  assert.equal(
    await outcome(request("POS", { outletId: IDS.outlet, tenantId: IDS.otherTenant }).result),
    "WORKSPACE_ACCESS_DENIED",
  );
});

test("on a device nobody acts for every outlet, whatever their role allows elsewhere", async () => {
  // The owner may read the whole catalog from a backoffice session.
  assert.equal(await outcome(request("BACKOFFICE", { handler: "wholeCatalog" }).result), "ALLOWED");
  // Signed in on the cashier tablet, the same owner may not.
  assert.equal(
    await outcome(request("POS", { handler: "wholeCatalog" }).result),
    "LOCATION_SCOPE_DENIED",
  );
});

test("a backoffice session is not tied to a device that happens to be in the browser", async () => {
  const { incoming, result } = request("BACKOFFICE", { outletId: IDS.otherOutlet });
  assert.equal(await outcome(result), "ALLOWED");
  assert.equal(incoming.accessContext?.deviceId, undefined);
});

test("the workspace list on a device shrinks to the device's outlet", () => {
  const outlet = (id: string, name: string) => ({
    code: name.toUpperCase(),
    id,
    name,
    status: "ACTIVE" as const,
  });
  const contexts: WorkspaceContext[] = [
    {
      allOutlets: true,
      membershipId: owner.membershipId,
      outlets: [outlet(IDS.outlet, "Pusat"), outlet(IDS.otherOutlet, "Cabang")],
      permissionKeys: owner.permissionKeys,
      tenant: { currency: "IDR", id: IDS.tenant, name: "Kopi Lokal", slug: "kopi-lokal" },
    },
    {
      allOutlets: true,
      membershipId: "019f738d-e61f-7d46-92de-17b35f978008",
      outlets: [outlet("019f738d-e61f-7d46-92de-17b35f978009", "Lain")],
      permissionKeys: owner.permissionKeys,
      tenant: { currency: "IDR", id: IDS.otherTenant, name: "Usaha Lain", slug: "usaha-lain" },
    },
  ];

  const scoped = scopeWorkspacesToDevice(contexts, device);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.tenant.id, IDS.tenant);
  assert.equal(scoped[0]?.allOutlets, false);
  assert.deepEqual(
    scoped[0]?.outlets.map((item) => item.name),
    ["Pusat"],
  );

  // Someone who is not assigned to the device's outlet gets nothing to open.
  const cabangOnly = [{ ...contexts[0]!, outlets: [outlet(IDS.otherOutlet, "Cabang")] }];
  assert.deepEqual(scopeWorkspacesToDevice(cabangOnly, device), []);
});

test("what is sold on a device names the cashier as actor and the device beside them", () => {
  const origin = commandOriginFromRequest(
    IDS.user,
    { [API_HEADERS.clientChannel]: "WEB", [API_HEADERS.requestId]: "web_abc" },
    IDS.device,
  );
  assert.deepEqual(eventOrigin(origin, "CORE_ORDER"), {
    actorId: IDS.user,
    actorType: "USER",
    channel: "WEB",
    correlationId: "web_abc",
    deviceId: IDS.device,
    producer: "CORE_ORDER",
  });
  // Without a device session there is no device, whatever the client claims.
  assert.equal(commandOriginFromRequest(IDS.user, {}).deviceId, undefined);
});
