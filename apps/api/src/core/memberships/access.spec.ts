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
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
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
  async listMembers(tenantId: string) {
    return this.memberships
      .filter((item) => item.tenantId === tenantId)
      .map((item) => ({
        allOutlets: item.allOutlets,
        displayName: item.userId === IDS.userOwner ? "Pemilik" : "Staf",
        email: item.userId === IDS.userOwner ? "pemilik@example.com" : "staf@example.com",
        membershipId: item.id,
        outletIds: item.outletIds,
        roleIds: item.roleIds,
        status: item.status,
        userId: item.userId,
      }));
  }

  readonly sessionRevocations: string[] = [];

  async recordSessionRevocation(
    tenantId: string,
    membership: { id: string; userId: string },
    revokedSessions: number,
  ) {
    this.sessionRevocations.push(
      `${tenantId === IDS.tenantA ? "A" : "other"}:${membership.userId === IDS.userStaff ? "staff" : "owner"}:${revokedSessions}`,
    );
  }

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

  async listWorkspaceContexts(userId: string) {
    const memberships = this.memberships.filter(
      (membership) => membership.userId === userId && membership.status === "ACTIVE",
    );
    return Promise.all(
      memberships.map(async (membership) => {
        const authorization = await this.findAuthorization(userId, membership.tenantId);
        assert.ok(authorization);
        return {
          allOutlets: membership.allOutlets,
          membershipId: membership.id,
          outlets: this.outlets
            .filter(
              (outlet) =>
                outlet.tenantId === membership.tenantId &&
                (membership.allOutlets || membership.outletIds.includes(outlet.id)),
            )
            .map((outlet) => ({
              code: outlet.id === IDS.outletA ? "A-01" : "B-01",
              id: outlet.id,
              name: outlet.id === IDS.outletA ? "Outlet A" : "Outlet B",
              status: outlet.status,
            })),
          permissionKeys: authorization.permissionKeys,
          tenant: {
            currency: "IDR",
            id: membership.tenantId,
            name: membership.tenantId === IDS.tenantA ? "Tenant A" : "Tenant B",
            slug: membership.tenantId === IDS.tenantA ? "tenant-a" : "tenant-b",
          },
        };
      }),
    );
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
  assert.equal(access.permissionKeys.includes(PERMISSIONS.catalogRead), true);
  assert.equal(access.permissionKeys.includes(PERMISSIONS.catalogManage), true);
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

test("lists only workspace and outlet contexts assigned to the active user", async () => {
  const repository = new InMemoryAccessRepository();
  const service = new AccessService(repository);
  const role = await service.createRole(IDS.tenantA, {
    code: "CATALOG_VIEWER",
    name: "Catalog Viewer",
    permissionKeys: [PERMISSIONS.catalogRead],
  });
  await service.createMembership(IDS.tenantA, {
    allOutlets: false,
    outletIds: [IDS.outletA],
    roleIds: [role.id],
    userId: IDS.userStaff,
  });

  const contexts = await service.listWorkspaceContexts(IDS.userStaff);

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0]?.tenant.id, IDS.tenantA);
  assert.deepEqual(
    contexts[0]?.outlets.map((outlet) => outlet.id),
    [IDS.outletA],
  );
  assert.deepEqual(contexts[0]?.permissionKeys, [PERMISSIONS.catalogRead]);
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
    describeAccess: async () => ({
      context: {
        allOutlets: false,
        membershipId: IDS.membershipStaff,
        outletIds: [IDS.outletA],
        permissionKeys: [PERMISSIONS.organizationRead],
        tenantId: IDS.tenantA,
        userId: IDS.userStaff,
      },
      membershipActive: true,
    }),
  } as unknown as AccessService;
  let checkedModule: string | undefined;
  const entitlementService = {
    describeAccess: async (tenantId: string, moduleKey?: string) => {
      assert.equal(tenantId, IDS.tenantA);
      checkedModule = moduleKey;
      return { module: { entitled: false, tier: null }, subscriptionUsable: true };
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

// ---- Revocation (M2-SC-03)

async function workspaceWithStaff() {
  const repository = new InMemoryAccessRepository();
  const ended: string[] = [];
  const service = new AccessService(repository, undefined, {
    revokeUserSessions: async (userId: string) => {
      ended.push(userId);
      return 2;
    },
  });
  const role = await service.createRole(IDS.tenantA, {
    code: "CATALOG_VIEWER",
    name: "Catalog Viewer",
    permissionKeys: [PERMISSIONS.catalogRead],
  });
  const membership = await service.createMembership(IDS.tenantA, {
    allOutlets: false,
    outletIds: [IDS.outletA],
    roleIds: [role.id],
    userId: IDS.userStaff,
  });
  return { ended, membership, repository, role, service };
}

test("taking a member out of the workspace ends their sign-ins, once", async () => {
  const { ended, membership, repository, service } = await workspaceWithStaff();

  // Changing what they may do is not a removal.
  await service.updateMembership(IDS.tenantA, membership.id, { outletIds: [IDS.outletB] });
  assert.deepEqual(ended, []);

  const removed = await service.updateMembership(IDS.tenantA, membership.id, {
    status: "INACTIVE",
  });
  assert.equal(removed.status, "INACTIVE");
  assert.deepEqual(ended, [IDS.userStaff]);
  assert.deepEqual(repository.sessionRevocations, ["A:staff:2"]);

  // Saving the same state again, or letting them back in, ends nothing more.
  await service.updateMembership(IDS.tenantA, membership.id, { status: "INACTIVE" });
  await service.updateMembership(IDS.tenantA, membership.id, { status: "ACTIVE" });
  assert.deepEqual(ended, [IDS.userStaff]);
});

test("a removed member is refused at once, whatever session they still hold", async () => {
  const { membership, service } = await workspaceWithStaff();
  await service.authorize(IDS.userStaff, IDS.tenantA, PERMISSIONS.catalogRead, IDS.outletA);

  await service.updateMembership(IDS.tenantA, membership.id, { status: "INACTIVE" });
  await assert.rejects(
    () => service.authorize(IDS.userStaff, IDS.tenantA, PERMISSIONS.catalogRead, IDS.outletA),
    ForbiddenException,
  );
  assert.deepEqual(await service.listWorkspaceContexts(IDS.userStaff), []);
});

test("a member's sign-ins can be ended on their own, and the membership stays", async () => {
  const { ended, membership, repository, service } = await workspaceWithStaff();

  assert.deepEqual(await service.revokeMemberSessions(IDS.tenantA, membership.id), {
    revokedSessions: 2,
  });
  assert.deepEqual(ended, [IDS.userStaff]);
  assert.deepEqual(repository.sessionRevocations, ["A:staff:2"]);
  assert.equal(
    (await service.listMemberships(IDS.tenantA)).find((item) => item.id === membership.id)?.status,
    "ACTIVE",
  );
});

test("another workspace cannot end the sign-ins of this workspace's members", async () => {
  const { ended, membership, service } = await workspaceWithStaff();
  await assert.rejects(
    () => service.revokeMemberSessions(IDS.tenantB, membership.id),
    NotFoundException,
  );
  assert.deepEqual(ended, []);
});

test("the audit entry for ended sign-ins passes the audit guard", async () => {
  const { buildAuditMetadata, buildAuditPayload } = await import("../audit/public.js");
  // The same payload the repository writes; the guard rejects keys that name secrets.
  const payload = buildAuditPayload({ endedSignIns: 2, userId: IDS.userStaff });
  assert.deepEqual(buildAuditMetadata("membership.revoke_sessions", payload), {
    critical: true,
    endedSignIns: 2,
    userId: IDS.userStaff,
  });
  assert.throws(() => buildAuditPayload({ revokedSessions: 2 }), /Sensitive audit metadata/);
});

// ---- The people page (M2-FT-02)

test("the member list names people, and stays inside the workspace", async () => {
  const { membership, service } = await workspaceWithStaff();

  const { members } = await service.listMembers(IDS.tenantA);
  assert.deepEqual(
    members.map((item) => [item.membershipId, item.displayName, item.email, item.status]),
    [[membership.id, "Staf", "staf@example.com", "ACTIVE"]],
  );
  assert.deepEqual((await service.listMembers(IDS.tenantB)).members, []);
});

test("nobody can take away their own access", async () => {
  const { ended, membership, service } = await workspaceWithStaff();

  await assert.rejects(
    () =>
      service.updateMembership(
        IDS.tenantA,
        membership.id,
        { status: "INACTIVE" },
        { actorId: IDS.userStaff },
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { code: string }).code === "MEMBERSHIP_SELF_DEACTIVATE",
  );
  assert.deepEqual(ended, []);
  // Someone else can.
  const removed = await service.updateMembership(
    IDS.tenantA,
    membership.id,
    { status: "INACTIVE" },
    { actorId: IDS.userOwner },
  );
  assert.equal(removed.status, "INACTIVE");
});

test("nobody grants a permission they do not hold themselves", async () => {
  const { assertCanGrant } = await import("./grantable.js");
  const held = [PERMISSIONS.accessRoleManage, PERMISSIONS.catalogRead];

  assert.doesNotThrow(() => assertCanGrant(held, [PERMISSIONS.catalogRead]));
  // A change that does not touch permissions needs none.
  assert.doesNotThrow(() => assertCanGrant(held, undefined));
  assert.throws(
    () => assertCanGrant(held, [PERMISSIONS.catalogRead, PERMISSIONS.paymentRefund]),
    ForbiddenException,
  );
});
