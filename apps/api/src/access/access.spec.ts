import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULES,
  PERMISSIONS,
  type CreateMembership,
  type CreateRole,
  type UpdateMembership,
  type UpdateRole,
} from "@merchant/contracts";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlement/entitlement.service.js";
import type {
  AccessRepository,
  AuthorizationRecord,
  MembershipRecord,
  RoleRecord,
  SystemRoleDefinition,
} from "./access.repository.js";
import { AccessService } from "./access.service.js";
import { SessionPermissionGuard } from "./session-permission.guard.js";

const IDS = {
  membershipOwner: "019f738d-e61f-7d46-92de-17b35f970bb1",
  membershipStaff: "019f738d-e61f-7d46-92de-17b35f970bb2",
  outletA: "019f738d-e61f-7d46-92de-17b35f970b94",
  outletB: "019f738d-e61f-7d46-92de-17b35f970b95",
  outletOther: "019f738d-e61f-7d46-92de-17b35f970b96",
  roleCustom: "019f738d-e61f-7d46-92de-17b35f970ba1",
  roleOther: "019f738d-e61f-7d46-92de-17b35f970ba2",
  tenantA: "019f738d-e61f-7d46-92de-17b35f970b91",
  tenantB: "019f738d-e61f-7d46-92de-17b35f970b92",
  userOwner: "019f738d-e61f-7d46-92de-17b35f970b93",
  userStaff: "019f738d-e61f-7d46-92de-17b35f970b97",
} as const;

class InMemoryAccessRepository implements AccessRepository {
  readonly memberships: MembershipRecord[] = [];
  readonly roles: RoleRecord[] = [];
  readonly outlets = [
    { id: IDS.outletA, status: "ACTIVE" as const, tenantId: IDS.tenantA },
    { id: IDS.outletB, status: "ACTIVE" as const, tenantId: IDS.tenantA },
    { id: IDS.outletOther, status: "ACTIVE" as const, tenantId: IDS.tenantB },
  ];
  readonly tenants = [
    { id: IDS.tenantA, status: "ACTIVE" as const },
    { id: IDS.tenantB, status: "ACTIVE" as const },
  ];
  readonly users = [
    { id: IDS.userOwner, status: "ACTIVE" as const },
    { id: IDS.userStaff, status: "ACTIVE" as const },
  ];

  private now() {
    return new Date("2026-07-18T08:00:00.000Z");
  }

  async findTenant(tenantId: string) {
    return this.tenants.find((tenant) => tenant.id === tenantId) ?? null;
  }

  async findUser(userId: string) {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  async findOutlets(tenantId: string, outletIds: string[]) {
    return this.outlets.filter(
      (outlet) => outlet.tenantId === tenantId && outletIds.includes(outlet.id),
    );
  }

  async findRoles(tenantId: string, roleIds: string[]) {
    return this.roles.filter((role) => role.tenantId === tenantId && roleIds.includes(role.id));
  }

  async findRoleByCode(tenantId: string, code: string) {
    return this.roles.find((role) => role.tenantId === tenantId && role.code === code) ?? null;
  }

  async findRoleById(tenantId: string, roleId: string) {
    return this.roles.find((role) => role.tenantId === tenantId && role.id === roleId) ?? null;
  }

  async listRoles(tenantId: string) {
    return this.roles.filter((role) => role.tenantId === tenantId);
  }

  async listMemberships(tenantId: string) {
    return this.memberships.filter((membership) => membership.tenantId === tenantId);
  }

  async findMembershipById(tenantId: string, membershipId: string) {
    return (
      this.memberships.find(
        (membership) => membership.tenantId === tenantId && membership.id === membershipId,
      ) ?? null
    );
  }

  async findMembershipByUser(tenantId: string, userId: string) {
    return (
      this.memberships.find(
        (membership) => membership.tenantId === tenantId && membership.userId === userId,
      ) ?? null
    );
  }

  async createRole(tenantId: string, input: CreateRole) {
    const timestamp = this.now();
    const role: RoleRecord = {
      ...input,
      createdAt: timestamp,
      id: tenantId === IDS.tenantA ? IDS.roleCustom : IDS.roleOther,
      isSystem: false,
      status: "ACTIVE",
      tenantId,
      updatedAt: timestamp,
    };
    this.roles.push(role);
    return role;
  }

  async updateRole(tenantId: string, roleId: string, input: UpdateRole) {
    const role = await this.findRoleById(tenantId, roleId);
    assert.ok(role);
    Object.assign(role, input, { updatedAt: this.now() });
    return role;
  }

  async createMembership(tenantId: string, input: CreateMembership) {
    const timestamp = this.now();
    const membership: MembershipRecord = {
      ...input,
      createdAt: timestamp,
      id: input.userId === IDS.userOwner ? IDS.membershipOwner : IDS.membershipStaff,
      status: "ACTIVE",
      tenantId,
      updatedAt: timestamp,
    };
    this.memberships.push(membership);
    return membership;
  }

  async updateMembership(tenantId: string, membershipId: string, input: UpdateMembership) {
    const membership = await this.findMembershipById(tenantId, membershipId);
    assert.ok(membership);
    Object.assign(membership, input, { updatedAt: this.now() });
    return membership;
  }

  async findAuthorization(userId: string, tenantId: string): Promise<AuthorizationRecord | null> {
    const membership = await this.findMembershipByUser(tenantId, userId);
    if (!membership) return null;
    const permissionKeys = [
      ...new Set(
        this.roles
          .filter(
            (role) =>
              role.tenantId === tenantId &&
              role.status === "ACTIVE" &&
              membership.roleIds.includes(role.id),
          )
          .flatMap((role) => role.permissionKeys),
      ),
    ];
    return { ...membership, permissionKeys, tenantStatus: "ACTIVE", userStatus: "ACTIVE" };
  }

  async provisionTenantOwner(
    tenantId: string,
    userId: string,
    definitions: SystemRoleDefinition[],
  ) {
    const timestamp = this.now();
    definitions.forEach((definition, index) => {
      this.roles.push({
        ...definition,
        createdAt: timestamp,
        id: `019f738d-e61f-7d46-92de-17b35f970b${(index + 10).toString(16).padStart(2, "0")}`,
        isSystem: true,
        status: "ACTIVE",
        tenantId,
        updatedAt: timestamp,
      });
    });
    const ownerRole = this.roles.find(
      (role) => role.tenantId === tenantId && role.code === "OWNER",
    );
    assert.ok(ownerRole);
    return this.createMembership(tenantId, {
      allOutlets: true,
      outletIds: [],
      roleIds: [ownerRole.id],
      userId,
    });
  }
}

test("provisions an owner with all tenant permissions and all-outlet scope", async () => {
  const repository = new InMemoryAccessRepository();
  const service = new AccessService(repository);
  await service.provisionTenantOwner(IDS.tenantA, IDS.userOwner);

  const access = await service.authorize(
    IDS.userOwner,
    IDS.tenantA,
    PERMISSIONS.organizationManage,
    IDS.outletB,
  );

  assert.equal(access.allOutlets, true);
  assert.equal(access.permissionKeys.includes(PERMISSIONS.accessRoleManage), true);
});

test("enforces both permission and explicit outlet assignment", async () => {
  const repository = new InMemoryAccessRepository();
  const service = new AccessService(repository);
  const role = await service.createRole(IDS.tenantA, {
    code: "VIEWER",
    name: "Viewer",
    permissionKeys: [PERMISSIONS.organizationRead],
  });
  const updatedRole = await service.updateRole(IDS.tenantA, role.id, {
    name: "Organization Viewer",
    permissionKeys: [PERMISSIONS.organizationRead],
  });
  await service.createMembership(IDS.tenantA, {
    allOutlets: false,
    outletIds: [IDS.outletA],
    roleIds: [role.id],
    userId: IDS.userStaff,
  });

  assert.equal(
    (await service.authorize(IDS.userStaff, IDS.tenantA, PERMISSIONS.organizationRead, IDS.outletA))
      .userId,
    IDS.userStaff,
  );
  assert.equal(updatedRole.name, "Organization Viewer");
  assert.equal((await service.listMemberships(IDS.tenantA)).length, 1);
  await assert.rejects(
    () => service.authorize(IDS.userStaff, IDS.tenantA, PERMISSIONS.organizationManage),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.authorize(IDS.userStaff, IDS.tenantA, PERMISSIONS.organizationRead, IDS.outletB),
    ForbiddenException,
  );
});

test("rejects role and outlet assignments from another tenant", async () => {
  const repository = new InMemoryAccessRepository();
  const service = new AccessService(repository);
  const otherRole = await service.createRole(IDS.tenantB, {
    code: "OTHER",
    name: "Other Tenant Role",
    permissionKeys: [PERMISSIONS.organizationRead],
  });

  await assert.rejects(
    () =>
      service.createMembership(IDS.tenantA, {
        allOutlets: false,
        outletIds: [IDS.outletOther],
        roleIds: [otherRole.id],
        userId: IDS.userStaff,
      }),
    NotFoundException,
  );
});

test("rejects outlet-scoped actors from tenant-wide protected routes", async () => {
  const request = {
    headers: {
      cookie: `merchant_session=${"a".repeat(43)}`,
      "x-tenant-id": IDS.tenantA,
    },
  };
  const handler = () => undefined;
  Reflect.defineMetadata("require-all-outlets", true, handler);
  Reflect.defineMetadata("required-entitlement-module", MODULES.cafeProfile, handler);
  const context = {
    getClass: () => class TenantWideController {},
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const authService = {
    getSession: async () => ({
      expiresAt: "2026-08-18T00:00:00.000Z",
      user: { displayName: "Staff", email: "staff@example.com", id: IDS.userStaff },
    }),
  } as unknown as AuthService;
  const accessService = {
    authorize: async () => ({
      allOutlets: false,
      membershipId: IDS.membershipStaff,
      outletIds: [IDS.outletA],
      permissionKeys: [PERMISSIONS.organizationRead],
      tenantId: IDS.tenantA,
      userId: IDS.userStaff,
    }),
  } as unknown as AccessService;
  let checkedModule: string | undefined;
  const entitlementService = {
    requireAccess: async (tenantId: string, moduleKey?: string) => {
      assert.equal(tenantId, IDS.tenantA);
      checkedModule = moduleKey;
      return { modules: [], subscription: null };
    },
  } as unknown as EntitlementService;
  const guard = new SessionPermissionGuard(
    authService,
    accessService,
    entitlementService,
    new Reflector(),
  );

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
  assert.equal(checkedModule, MODULES.cafeProfile);
});

test("does not expose roles, memberships, or authorization across tenants", async () => {
  const repository = new InMemoryAccessRepository();
  const service = new AccessService(repository);
  const roleA = await service.createRole(IDS.tenantA, {
    code: "VIEWER_A",
    name: "Viewer A",
    permissionKeys: [PERMISSIONS.organizationRead],
  });
  const roleB = await service.createRole(IDS.tenantB, {
    code: "VIEWER_B",
    name: "Viewer B",
    permissionKeys: [PERMISSIONS.organizationRead],
  });
  await service.createMembership(IDS.tenantA, {
    allOutlets: false,
    outletIds: [IDS.outletA],
    roleIds: [roleA.id],
    userId: IDS.userStaff,
  });

  assert.deepEqual(
    (await service.listRoles(IDS.tenantA)).map((role) => role.id),
    [roleA.id],
  );
  assert.deepEqual(
    (await service.listRoles(IDS.tenantB)).map((role) => role.id),
    [roleB.id],
  );
  assert.equal((await service.listMemberships(IDS.tenantB)).length, 0);
  await assert.rejects(
    () => service.authorize(IDS.userStaff, IDS.tenantB, PERMISSIONS.organizationRead),
    ForbiddenException,
  );
});
