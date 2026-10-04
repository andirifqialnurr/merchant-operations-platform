import {
  authorizationContextSchema,
  createMembershipSchema,
  createRoleSchema,
  memberListSchema,
  membershipSchema,
  PERMISSIONS,
  roleSchema,
  updateMembershipSchema,
  updateRoleSchema,
  workspaceContextsSchema,
  type AuthorizationContext,
  type CreateMembership,
  type CreateRole,
  type PermissionKey,
  type UpdateMembership,
  type UpdateRole,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, Optional, NotFoundException } from "@nestjs/common";

import { accessDenied, assertAccess, evaluateAccess } from "../entitlements/public.js";
import {
  ACCESS_REPOSITORY,
  type AccessMutationContext,
  type AccessRepository,
  type MembershipRecord,
  type RoleRecord,
  type SystemRoleDefinition,
} from "./access.repository.js";
import { LIMIT_GATE, NO_LIMITS, type LimitGate } from "../../shared/limits/limit-gate.js";
import { AuthService } from "../auth/public.js";

/** The part of sign-in handling this service needs. */
type SessionRevoker = Pick<AuthService, "revokeUserSessions">;

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const DEFAULT_ROLE_DEFINITIONS: SystemRoleDefinition[] = [
  { code: "OWNER", name: "Owner", permissionKeys: ALL_PERMISSIONS },
  {
    code: "MANAGER",
    name: "Manager",
    permissionKeys: ALL_PERMISSIONS.filter(
      (permission) => permission !== PERMISSIONS.accessRoleManage,
    ),
  },
  {
    code: "CASHIER",
    name: "Cashier",
    permissionKeys: [
      PERMISSIONS.orderCreate,
      PERMISSIONS.orderCancel,
      PERMISSIONS.orderMoveTable,
      PERMISSIONS.tableView,
      PERMISSIONS.paymentConfirm,
      PERMISSIONS.shiftOpen,
      PERMISSIONS.shiftClose,
    ],
  },
  { code: "KITCHEN", name: "Kitchen", permissionKeys: [] },
  {
    code: "WAITER",
    name: "Waiter",
    permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.orderMoveTable, PERMISSIONS.tableView],
  },
  {
    code: "INVENTORY_STAFF",
    name: "Inventory Staff",
    permissionKeys: [
      PERMISSIONS.inventoryReceive,
      PERMISSIONS.inventoryAdjust,
      PERMISSIONS.inventoryStocktake,
    ],
  },
  {
    code: "FINANCE_STAFF",
    name: "Finance Staff",
    permissionKeys: [
      PERMISSIONS.financeDashboardView,
      PERMISSIONS.financeExpenseCreate,
      PERMISSIONS.financeReportExport,
      PERMISSIONS.paymentReconcile,
    ],
  },
];

function notFound(code: string, message: string) {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

/** A user in a workspace, as far as access is concerned. `context` is null for a non-member. */
export type AccessDescription = {
  context: AuthorizationContext | null;
  location?: { active: boolean; inScope: boolean };
  membershipActive: boolean;
};

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function toRole(record: RoleRecord) {
  return roleSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toMembership(record: MembershipRecord) {
  return membershipSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

@Injectable()
export class AccessService {
  constructor(
    @Inject(ACCESS_REPOSITORY) private readonly repository: AccessRepository,
    @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
    @Optional() @Inject(AuthService) private readonly sessions?: SessionRevoker,
  ) {}

  private async requireActiveTenant(tenantId: string) {
    const tenant = await this.repository.findTenant(tenantId);
    if (!tenant) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    if (tenant.status !== "ACTIVE") throw conflict("TENANT_INACTIVE", "Tenant tidak aktif.");
  }

  private async requireActiveUser(userId: string) {
    const user = await this.repository.findUser(userId);
    if (!user) throw notFound("USER_NOT_FOUND", "User tidak ditemukan.");
    if (user.status !== "ACTIVE") throw conflict("USER_INACTIVE", "User tidak aktif.");
  }

  private async requireActiveRoles(tenantId: string, roleIds: string[]) {
    const roles = await this.repository.findRoles(tenantId, roleIds);
    if (roles.length !== roleIds.length)
      throw notFound("ROLE_NOT_FOUND", "Salah satu role tidak ditemukan pada tenant ini.");
    if (roles.some((role) => role.status !== "ACTIVE"))
      throw conflict("ROLE_INACTIVE", "Role yang tidak aktif tidak dapat diberikan.");
  }

  private async requireActiveOutlets(tenantId: string, outletIds: string[]) {
    if (outletIds.length === 0) return;
    const outlets = await this.repository.findOutlets(tenantId, outletIds);
    if (outlets.length !== outletIds.length)
      throw notFound("OUTLET_NOT_FOUND", "Salah satu outlet tidak ditemukan pada tenant ini.");
    if (outlets.some((outlet) => outlet.status !== "ACTIVE"))
      throw conflict("OUTLET_INACTIVE", "Outlet yang tidak aktif tidak dapat diberikan.");
  }

  async createRole(tenantId: string, input: CreateRole, context?: AccessMutationContext) {
    await this.requireActiveTenant(tenantId);
    const parsed = createRoleSchema.parse(input);
    if (await this.repository.findRoleByCode(tenantId, parsed.code))
      throw conflict("ROLE_CODE_CONFLICT", "Kode role sudah digunakan pada tenant ini.");
    await this.limits.assertCanAdd(tenantId, "core.roles.custom");
    try {
      return toRole(await this.repository.createRole(tenantId, parsed, context));
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw conflict("ROLE_CODE_CONFLICT", "Kode role sudah digunakan pada tenant ini.");
      throw error;
    }
  }

  async listRoles(tenantId: string) {
    await this.requireActiveTenant(tenantId);
    return this.repository.listRoles(tenantId).then((roles) => roles.map(toRole));
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: UpdateRole,
    context?: AccessMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findRoleById(tenantId, roleId);
    if (!current) throw notFound("ROLE_NOT_FOUND", "Role tidak ditemukan pada tenant ini.");
    if (current.isSystem) {
      throw conflict("SYSTEM_ROLE_IMMUTABLE", "System role tidak dapat diubah.");
    }
    return toRole(
      await this.repository.updateRole(tenantId, roleId, updateRoleSchema.parse(input), context),
    );
  }

  async listMemberships(tenantId: string) {
    await this.requireActiveTenant(tenantId);
    return this.repository
      .listMemberships(tenantId)
      .then((memberships) => memberships.map(toMembership));
  }

  /** The people of the workspace, with who they are. */
  async listMembers(tenantId: string) {
    await this.requireActiveTenant(tenantId);
    return memberListSchema.parse({ members: await this.repository.listMembers(tenantId) });
  }

  async listWorkspaceContexts(userId: string) {
    return workspaceContextsSchema.parse(await this.repository.listWorkspaceContexts(userId));
  }

  async createMembership(
    tenantId: string,
    input: CreateMembership,
    context?: AccessMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const parsed = createMembershipSchema.parse(input);
    await this.requireActiveUser(parsed.userId);
    if (await this.repository.findMembershipByUser(tenantId, parsed.userId))
      throw conflict("MEMBERSHIP_CONFLICT", "User sudah menjadi anggota tenant ini.");
    await this.limits.assertCanAdd(tenantId, "core.users.active");
    await Promise.all([
      this.requireActiveRoles(tenantId, parsed.roleIds),
      this.requireActiveOutlets(tenantId, parsed.outletIds),
    ]);
    try {
      return toMembership(await this.repository.createMembership(tenantId, parsed, context));
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw conflict("MEMBERSHIP_CONFLICT", "User sudah menjadi anggota tenant ini.");
      throw error;
    }
  }

  async updateMembership(
    tenantId: string,
    membershipId: string,
    input: UpdateMembership,
    context?: AccessMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const current = await this.repository.findMembershipById(tenantId, membershipId);
    if (!current)
      throw notFound("MEMBERSHIP_NOT_FOUND", "Membership tidak ditemukan pada tenant ini.");
    const parsed = updateMembershipSchema.parse(input);
    // Nobody locks themselves out: someone else has to take their access away.
    if (parsed.status === "INACTIVE" && context?.actorId === current.userId) {
      throw conflict("MEMBERSHIP_SELF_DEACTIVATE", "You cannot remove your own access.");
    }
    if (parsed.roleIds) await this.requireActiveRoles(tenantId, parsed.roleIds);
    if (parsed.outletIds) await this.requireActiveOutlets(tenantId, parsed.outletIds);
    const normalized =
      parsed.outletIds && parsed.allOutlets === undefined && current.allOutlets
        ? { ...parsed, allOutlets: false }
        : parsed;
    const wasActive = current.status === "ACTIVE";
    const updated = await this.repository.updateMembership(
      tenantId,
      membershipId,
      normalized,
      context,
    );
    // Taking someone out of the workspace ends what they have open right now.
    if (wasActive && updated.status !== "ACTIVE") {
      await this.endSessions(tenantId, updated, context);
    }
    return toMembership(updated);
  }

  private async endSessions(
    tenantId: string,
    membership: { id: string; userId: string },
    context?: AccessMutationContext,
  ) {
    const revokedSessions = (await this.sessions?.revokeUserSessions(membership.userId)) ?? 0;
    await this.repository.recordSessionRevocation(tenantId, membership, revokedSessions, context);
    return revokedSessions;
  }

  /**
   * Ends every sign-in of a member, e.g. after a lost phone. The membership
   * stays as it is, so the person can sign in again.
   */
  async revokeMemberSessions(
    tenantId: string,
    membershipId: string,
    context?: AccessMutationContext,
  ) {
    await this.requireActiveTenant(tenantId);
    const membership = await this.repository.findMembershipById(tenantId, membershipId);
    if (!membership)
      throw notFound("MEMBERSHIP_NOT_FOUND", "Membership tidak ditemukan pada tenant ini.");
    return { revokedSessions: await this.endSessions(tenantId, membership, context) };
  }

  async provisionTenantOwner(tenantId: string, userId: string, context?: AccessMutationContext) {
    await this.requireActiveTenant(tenantId);
    await this.requireActiveUser(userId);
    if (await this.repository.findMembershipByUser(tenantId, userId))
      throw conflict("MEMBERSHIP_CONFLICT", "User sudah menjadi anggota tenant ini.");
    return toMembership(
      await this.repository.provisionTenantOwner(
        tenantId,
        userId,
        DEFAULT_ROLE_DEFINITIONS,
        context,
      ),
    );
  }

  /**
   * What the access evaluator needs to know about this user in this workspace,
   * and about the location when the request names one.
   */
  async describeAccess(
    userId: string,
    tenantId: string,
    outletId?: string,
  ): Promise<AccessDescription> {
    const access = await this.repository.findAuthorization(userId, tenantId);
    const membershipActive =
      access?.userStatus === "ACTIVE" &&
      access.tenantStatus === "ACTIVE" &&
      access.status === "ACTIVE";
    if (!access || !membershipActive) return { context: null, membershipActive: false };

    let location: { active: boolean; inScope: boolean } | undefined;
    if (outletId) {
      const outlets = await this.repository.findOutlets(tenantId, [outletId]);
      location = {
        active: outlets.length === 1 && outlets[0]?.status === "ACTIVE",
        inScope: access.allOutlets || access.outletIds.includes(outletId),
      };
    }
    return {
      context: authorizationContextSchema.parse({
        allOutlets: access.allOutlets,
        membershipId: access.id,
        outletIds: access.outletIds,
        permissionKeys: access.permissionKeys,
        tenantId,
        userId,
      }),
      ...(location ? { location } : {}),
      membershipActive: true,
    };
  }

  /** Membership, permission, and location check on its own, without the subscription. */
  async authorize(
    userId: string,
    tenantId: string,
    permission?: PermissionKey,
    outletId?: string,
  ): Promise<AuthorizationContext> {
    const access = await this.describeAccess(userId, tenantId, outletId);
    assertAccess(
      evaluateAccess(
        {
          allLocations: access.context?.allOutlets ?? false,
          ...(access.location ? { location: access.location } : {}),
          membershipActive: access.membershipActive,
          permissionKeys: access.context?.permissionKeys ?? [],
          subscriptionUsable: true,
        },
        permission ? { permission } : {},
      ),
    );
    if (!access.context) throw accessDenied("WORKSPACE_ACCESS_DENIED");
    return access.context;
  }
}
