import {
  authorizationContextSchema,
  createMembershipSchema,
  createRoleSchema,
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
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ACCESS_REPOSITORY,
  type AccessMutationContext,
  type AccessRepository,
  type MembershipRecord,
  type RoleRecord,
  type SystemRoleDefinition,
} from "./access.repository.js";

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

function denied() {
  return new ForbiddenException({
    code: "AUTHORIZATION_DENIED",
    message: "Anda tidak memiliki akses untuk tindakan ini.",
  });
}

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
  constructor(@Inject(ACCESS_REPOSITORY) private readonly repository: AccessRepository) {}

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
    if (parsed.roleIds) await this.requireActiveRoles(tenantId, parsed.roleIds);
    if (parsed.outletIds) await this.requireActiveOutlets(tenantId, parsed.outletIds);
    const normalized =
      parsed.outletIds && parsed.allOutlets === undefined && current.allOutlets
        ? { ...parsed, allOutlets: false }
        : parsed;
    return toMembership(
      await this.repository.updateMembership(tenantId, membershipId, normalized, context),
    );
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

  async authorize(
    userId: string,
    tenantId: string,
    permission?: PermissionKey,
    outletId?: string,
  ): Promise<AuthorizationContext> {
    const access = await this.repository.findAuthorization(userId, tenantId);
    if (
      !access ||
      access.userStatus !== "ACTIVE" ||
      access.tenantStatus !== "ACTIVE" ||
      access.status !== "ACTIVE"
    )
      throw denied();
    if (permission && !access.permissionKeys.includes(permission)) throw denied();
    if (outletId) {
      const outlets = await this.repository.findOutlets(tenantId, [outletId]);
      if (outlets.length !== 1 || outlets[0]?.status !== "ACTIVE") throw denied();
      if (!access.allOutlets && !access.outletIds.includes(outletId)) throw denied();
    }
    return authorizationContextSchema.parse({
      allOutlets: access.allOutlets,
      membershipId: access.id,
      outletIds: access.outletIds,
      permissionKeys: access.permissionKeys,
      tenantId,
      userId,
    });
  }
}
