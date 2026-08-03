import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { API_HEADERS, MODULES, PERMISSIONS, type AuthorizationContext } from "@merchant/contracts";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthService } from "../auth/auth.service.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { CatalogController } from "../catalog/catalog.controller.js";
import type { CatalogService } from "../catalog/catalog.service.js";
import type { EntitlementService } from "../entitlement/entitlement.service.js";
import type { AccessService } from "../access/access.service.js";
import { SessionPermissionGuard } from "../access/session-permission.guard.js";

const IDS = {
  membershipA: "019f738d-e61f-7d46-92de-17b35f972501",
  outletA: "019f738d-e61f-7d46-92de-17b35f972502",
  outletB: "019f738d-e61f-7d46-92de-17b35f972503",
  tenantA: "019f738d-e61f-7d46-92de-17b35f972504",
  tenantB: "019f738d-e61f-7d46-92de-17b35f972505",
  userA: "019f738d-e61f-7d46-92de-17b35f972506",
} as const;

type AuthorizedRequest = {
  accessContext?: AuthorizationContext;
  headers: Record<string, string | undefined>;
};

function createContext(request: AuthorizedRequest, handler: () => undefined, controller: object) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function metadataHandler({
  moduleKey = MODULES.coreCatalog,
  permission = PERMISSIONS.catalogRead,
  requireAllOutlets = false,
}: {
  moduleKey?: string;
  permission?: string;
  requireAllOutlets?: boolean;
}) {
  const handler = () => undefined;
  const controller = class TenantOutletIsolationController {};
  Reflect.defineMetadata("required-access-permission", permission, handler);
  Reflect.defineMetadata("required-entitlement-module", moduleKey, controller);
  if (requireAllOutlets) Reflect.defineMetadata("require-all-outlets", true, handler);
  return { controller, handler };
}

function createGuard({
  accessContext,
  allowTenant = IDS.tenantA,
}: {
  accessContext: AuthorizationContext;
  allowTenant?: string;
}) {
  const authCalls: Array<string | undefined> = [];
  const accessCalls: Array<{
    outletId?: string | undefined;
    permission?: string | undefined;
    tenantId: string;
    userId: string;
  }> = [];
  const entitlementCalls: Array<{ moduleKey?: string | undefined; tenantId: string }> = [];
  const authService = {
    getSession: async (token?: string) => {
      authCalls.push(token);
      return {
        expiresAt: "2026-08-03T10:00:00.000Z",
        user: { displayName: "Tenant A User", email: "tenant-a@example.test", id: IDS.userA },
      };
    },
  } as unknown as AuthService;
  const accessService = {
    authorize: async (userId: string, tenantId: string, permission?: string, outletId?: string) => {
      accessCalls.push({ outletId, permission, tenantId, userId });
      if (tenantId !== allowTenant) {
        throw new ForbiddenException({
          code: "AUTHORIZATION_DENIED",
          message: "Anda tidak memiliki akses untuk tindakan ini.",
        });
      }
      return { ...accessContext, outletIds: accessContext.outletIds };
    },
  } as unknown as AccessService;
  const entitlementService = {
    requireAccess: async (tenantId: string, moduleKey?: string) => {
      entitlementCalls.push({ moduleKey, tenantId });
      return { modules: [], subscription: null };
    },
  } as unknown as EntitlementService;

  return {
    accessCalls,
    authCalls,
    entitlementCalls,
    guard: new SessionPermissionGuard(
      authService,
      accessService,
      entitlementService,
      new Reflector(),
    ),
  };
}

function requestHeaders(tenantId: string = IDS.tenantA, outletId?: string) {
  return {
    cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(43)}`,
    [API_HEADERS.tenantId]: tenantId,
    ...(outletId ? { [API_HEADERS.outletId]: outletId } : {}),
  };
}

test("outlet-scoped routes authorize only the requested tenant and outlet context", async () => {
  const request: AuthorizedRequest = { headers: requestHeaders(IDS.tenantA, IDS.outletA) };
  const accessContext: AuthorizationContext = {
    allOutlets: false,
    membershipId: IDS.membershipA,
    outletIds: [IDS.outletA],
    permissionKeys: [PERMISSIONS.catalogRead],
    tenantId: IDS.tenantA,
    userId: IDS.userA,
  };
  const { controller, handler } = metadataHandler({});
  const { accessCalls, entitlementCalls, guard } = createGuard({ accessContext });

  assert.equal(await guard.canActivate(createContext(request, handler, controller)), true);
  assert.deepEqual(accessCalls, [
    {
      outletId: IDS.outletA,
      permission: PERMISSIONS.catalogRead,
      tenantId: IDS.tenantA,
      userId: IDS.userA,
    },
  ]);
  assert.deepEqual(entitlementCalls, [{ moduleKey: MODULES.coreCatalog, tenantId: IDS.tenantA }]);
  assert.deepEqual(request.accessContext, accessContext);
});

test("tenant-wide routes reject outlet-scoped actors after entitlement is checked for the same tenant", async () => {
  const request = { headers: requestHeaders() };
  const accessContext: AuthorizationContext = {
    allOutlets: false,
    membershipId: IDS.membershipA,
    outletIds: [IDS.outletA],
    permissionKeys: [PERMISSIONS.catalogRead],
    tenantId: IDS.tenantA,
    userId: IDS.userA,
  };
  const { controller, handler } = metadataHandler({ requireAllOutlets: true });
  const { entitlementCalls, guard } = createGuard({ accessContext });

  await assert.rejects(() => guard.canActivate(createContext(request, handler, controller)), {
    name: "ForbiddenException",
  });
  assert.deepEqual(entitlementCalls, [{ moduleKey: MODULES.coreCatalog, tenantId: IDS.tenantA }]);
});

test("cross-tenant headers are denied before a feature entitlement is evaluated", async () => {
  const request = { headers: requestHeaders(IDS.tenantB, IDS.outletB) };
  const accessContext: AuthorizationContext = {
    allOutlets: false,
    membershipId: IDS.membershipA,
    outletIds: [IDS.outletA],
    permissionKeys: [PERMISSIONS.catalogRead],
    tenantId: IDS.tenantA,
    userId: IDS.userA,
  };
  const { controller, handler } = metadataHandler({});
  const { accessCalls, entitlementCalls, guard } = createGuard({ accessContext });

  await assert.rejects(() => guard.canActivate(createContext(request, handler, controller)), {
    name: "ForbiddenException",
  });
  assert.equal(accessCalls[0]?.tenantId, IDS.tenantB);
  assert.equal(accessCalls[0]?.outletId, IDS.outletB);
  assert.deepEqual(entitlementCalls, []);
});

test("invalid tenant or outlet headers stop before session and authorization lookup", async () => {
  const request = {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(43)}`,
      [API_HEADERS.outletId]: "not-a-uuid",
      [API_HEADERS.tenantId]: IDS.tenantA,
    },
  };
  const accessContext: AuthorizationContext = {
    allOutlets: true,
    membershipId: IDS.membershipA,
    outletIds: [],
    permissionKeys: [PERMISSIONS.catalogRead],
    tenantId: IDS.tenantA,
    userId: IDS.userA,
  };
  const { controller, handler } = metadataHandler({});
  const { accessCalls, authCalls, guard } = createGuard({ accessContext });

  await assert.rejects(
    () => guard.canActivate(createContext(request, handler, controller)),
    BadRequestException,
  );
  assert.deepEqual(authCalls, []);
  assert.deepEqual(accessCalls, []);
});

test("catalog outlet routes reject header and route outlet mismatch before calling the service", async () => {
  let serviceCalled = false;
  const service = {
    createOutletProduct: async () => {
      serviceCalled = true;
      return {};
    },
  } as unknown as CatalogService;
  const controller = new CatalogController(service);

  await assert.rejects(
    () =>
      controller.createOutletProduct(
        {
          [API_HEADERS.outletId]: IDS.outletA,
          [API_HEADERS.tenantId]: IDS.tenantA,
        },
        { outletId: IDS.outletB },
        {
          availabilityOverride: null,
          displayOrder: 0,
          priceOverrideMinor: null,
          productId: "019f738d-e61f-7d46-92de-17b35f972507",
        },
        {
          allOutlets: false,
          membershipId: IDS.membershipA,
          outletIds: [IDS.outletA],
          permissionKeys: [PERMISSIONS.catalogManage],
          tenantId: IDS.tenantA,
          userId: IDS.userA,
        },
      ),
    BadRequestException,
  );
  assert.equal(serviceCalled, false);
});
