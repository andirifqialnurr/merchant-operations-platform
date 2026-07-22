import type {
  CreateMembership,
  CreateRole,
  MembershipStatus,
  OrganizationUnitStatus,
  PermissionKey,
  UpdateMembership,
  UpdateRole,
} from "@merchant/contracts";
import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type AccessMutationContext = { actorId?: string; requestId?: string };

export type RoleRecord = {
  code: string;
  createdAt: Date;
  id: string;
  isSystem: boolean;
  name: string;
  permissionKeys: PermissionKey[];
  status: OrganizationUnitStatus;
  tenantId: string;
  updatedAt: Date;
};

export type MembershipRecord = {
  allOutlets: boolean;
  createdAt: Date;
  id: string;
  outletIds: string[];
  roleIds: string[];
  status: MembershipStatus;
  tenantId: string;
  updatedAt: Date;
  userId: string;
};

export type AuthorizationRecord = MembershipRecord & {
  permissionKeys: PermissionKey[];
  tenantStatus: OrganizationUnitStatus;
  userStatus: "ACTIVE" | "DISABLED";
};

export type WorkspaceContextRecord = {
  allOutlets: boolean;
  membershipId: string;
  outlets: Array<{
    code: string;
    id: string;
    name: string;
    status: OrganizationUnitStatus;
  }>;
  permissionKeys: PermissionKey[];
  tenant: { id: string; name: string; slug: string };
};

export type SystemRoleDefinition = {
  code: string;
  name: string;
  permissionKeys: PermissionKey[];
};

export interface AccessRepository {
  createMembership(
    tenantId: string,
    input: CreateMembership,
    context?: AccessMutationContext,
  ): Promise<MembershipRecord>;
  createRole(
    tenantId: string,
    input: CreateRole,
    context?: AccessMutationContext,
  ): Promise<RoleRecord>;
  findAuthorization(userId: string, tenantId: string): Promise<AuthorizationRecord | null>;
  findMembershipById(tenantId: string, membershipId: string): Promise<MembershipRecord | null>;
  findMembershipByUser(tenantId: string, userId: string): Promise<MembershipRecord | null>;
  findOutlets(
    tenantId: string,
    outletIds: string[],
  ): Promise<Array<{ id: string; status: OrganizationUnitStatus }>>;
  findRoleByCode(tenantId: string, code: string): Promise<RoleRecord | null>;
  findRoleById(tenantId: string, roleId: string): Promise<RoleRecord | null>;
  findRoles(tenantId: string, roleIds: string[]): Promise<RoleRecord[]>;
  findTenant(tenantId: string): Promise<{ id: string; status: OrganizationUnitStatus } | null>;
  findUser(userId: string): Promise<{ id: string; status: "ACTIVE" | "DISABLED" } | null>;
  listRoles(tenantId: string): Promise<RoleRecord[]>;
  listMemberships(tenantId: string): Promise<MembershipRecord[]>;
  listWorkspaceContexts(userId: string): Promise<WorkspaceContextRecord[]>;
  provisionTenantOwner(
    tenantId: string,
    userId: string,
    roles: SystemRoleDefinition[],
    context?: AccessMutationContext,
  ): Promise<MembershipRecord>;
  updateMembership(
    tenantId: string,
    membershipId: string,
    input: UpdateMembership,
    context?: AccessMutationContext,
  ): Promise<MembershipRecord>;
  updateRole(
    tenantId: string,
    roleId: string,
    input: UpdateRole,
    context?: AccessMutationContext,
  ): Promise<RoleRecord>;
}

export const ACCESS_REPOSITORY = Symbol("ACCESS_REPOSITORY");

const roleSelect = {
  code: true,
  createdAt: true,
  id: true,
  isSystem: true,
  name: true,
  permissions: { orderBy: { permissionKey: "asc" as const }, select: { permissionKey: true } },
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const membershipSelect = {
  allOutlets: true,
  assignments: { orderBy: { outletId: "asc" as const }, select: { outletId: true } },
  createdAt: true,
  id: true,
  roles: { orderBy: { roleId: "asc" as const }, select: { roleId: true } },
  status: true,
  tenantId: true,
  updatedAt: true,
  userId: true,
} as const;

function mapRole(record: {
  code: string;
  createdAt: Date;
  id: string;
  isSystem: boolean;
  name: string;
  permissions: Array<{ permissionKey: string }>;
  status: OrganizationUnitStatus;
  tenantId: string;
  updatedAt: Date;
}): RoleRecord {
  const { permissions, ...role } = record;
  return {
    ...role,
    permissionKeys: permissions.map((item) => item.permissionKey as PermissionKey),
  };
}

function mapMembership(record: {
  allOutlets: boolean;
  assignments: Array<{ outletId: string }>;
  createdAt: Date;
  id: string;
  roles: Array<{ roleId: string }>;
  status: MembershipStatus;
  tenantId: string;
  updatedAt: Date;
  userId: string;
}): MembershipRecord {
  return {
    allOutlets: record.allOutlets,
    createdAt: record.createdAt,
    id: record.id,
    outletIds: record.assignments.map((item) => item.outletId),
    roleIds: record.roles.map((item) => item.roleId),
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt,
    userId: record.userId,
  };
}

async function writeAccessChange(
  transaction: Pick<DatabaseClient, "auditLog" | "outboxEvent">,
  options: {
    action: string;
    actorId?: string;
    entityId: string;
    entityType: "membership" | "role";
    payload: object;
    requestId?: string;
    tenantId: string;
  },
) {
  await transaction.auditLog.create({
    data: {
      action: options.action,
      ...(options.actorId ? { actorId: options.actorId } : {}),
      entityId: options.entityId,
      entityType: options.entityType,
      metadata: options.payload,
      ...(options.requestId ? { requestId: options.requestId } : {}),
      tenantId: options.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      aggregateId: options.entityId,
      aggregateType: options.entityType,
      payload: options.payload,
      tenantId: options.tenantId,
      type: `identity.${options.entityType}.${options.action.split(".").at(-1)}`,
    },
  });
}

@Injectable()
export class PrismaAccessRepository implements AccessRepository {
  async findTenant(tenantId: string) {
    return getPrismaClient().tenant.findUnique({
      select: { id: true, status: true },
      where: { id: tenantId },
    });
  }

  async findUser(userId: string) {
    return getPrismaClient().user.findUnique({
      select: { id: true, status: true },
      where: { id: userId },
    });
  }

  async findOutlets(tenantId: string, outletIds: string[]) {
    return getPrismaClient().outlet.findMany({
      orderBy: { id: "asc" },
      select: { id: true, status: true },
      where: { id: { in: outletIds }, tenantId },
    });
  }

  async findRoles(tenantId: string, roleIds: string[]) {
    const roles = await getPrismaClient().role.findMany({
      orderBy: { id: "asc" },
      select: roleSelect,
      where: { id: { in: roleIds }, tenantId },
    });
    return roles.map(mapRole);
  }

  async findRoleByCode(tenantId: string, code: string) {
    const role = await getPrismaClient().role.findUnique({
      select: roleSelect,
      where: { tenantId_code: { code, tenantId } },
    });
    return role ? mapRole(role) : null;
  }

  async findRoleById(tenantId: string, roleId: string) {
    const role = await getPrismaClient().role.findUnique({
      select: roleSelect,
      where: { tenantId_id: { id: roleId, tenantId } },
    });
    return role ? mapRole(role) : null;
  }

  async listRoles(tenantId: string) {
    const roles = await getPrismaClient().role.findMany({
      orderBy: { createdAt: "asc" },
      select: roleSelect,
      where: { tenantId },
    });
    return roles.map(mapRole);
  }

  async listMemberships(tenantId: string) {
    const memberships = await getPrismaClient().tenantMembership.findMany({
      orderBy: { createdAt: "asc" },
      select: membershipSelect,
      where: { tenantId },
    });
    return memberships.map(mapMembership);
  }

  async listWorkspaceContexts(userId: string) {
    const memberships = await getPrismaClient().tenantMembership.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        allOutlets: true,
        assignments: {
          orderBy: { outletId: "asc" },
          select: {
            outlet: { select: { code: true, id: true, name: true, status: true } },
          },
        },
        id: true,
        roles: {
          select: {
            role: {
              select: {
                permissions: { select: { permissionKey: true } },
                status: true,
              },
            },
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            outlets: {
              orderBy: { createdAt: "asc" },
              select: { code: true, id: true, name: true, status: true },
              where: { status: "ACTIVE" },
            },
            slug: true,
          },
        },
      },
      where: { status: "ACTIVE", tenant: { status: "ACTIVE" }, userId },
    });

    return memberships.map((membership) => ({
      allOutlets: membership.allOutlets,
      membershipId: membership.id,
      outlets: membership.allOutlets
        ? membership.tenant.outlets
        : membership.assignments
            .map((assignment) => assignment.outlet)
            .filter((outlet) => outlet.status === "ACTIVE"),
      permissionKeys: [
        ...new Set(
          membership.roles.flatMap((link) =>
            link.role.status === "ACTIVE"
              ? link.role.permissions.map((permission) => permission.permissionKey as PermissionKey)
              : [],
          ),
        ),
      ].sort(),
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
      },
    }));
  }

  async findMembershipById(tenantId: string, membershipId: string) {
    const membership = await getPrismaClient().tenantMembership.findUnique({
      select: membershipSelect,
      where: { tenantId_id: { id: membershipId, tenantId } },
    });
    return membership ? mapMembership(membership) : null;
  }

  async findMembershipByUser(tenantId: string, userId: string) {
    const membership = await getPrismaClient().tenantMembership.findUnique({
      select: membershipSelect,
      where: { tenantId_userId: { tenantId, userId } },
    });
    return membership ? mapMembership(membership) : null;
  }

  async createRole(tenantId: string, input: CreateRole, context?: AccessMutationContext) {
    return getPrismaClient().$transaction(async (transaction) => {
      const role = await transaction.role.create({
        data: {
          code: input.code,
          name: input.name,
          tenantId,
          permissions: {
            create: input.permissionKeys.map((permissionKey) => ({ permissionKey })),
          },
        },
        select: roleSelect,
      });
      await writeAccessChange(transaction, {
        action: "role.create",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: role.id,
        entityType: "role",
        payload: { after: mapRole(role) },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapRole(role);
    });
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: UpdateRole,
    context?: AccessMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.role.findUniqueOrThrow({
        select: roleSelect,
        where: { tenantId_id: { id: roleId, tenantId } },
      });
      if (input.permissionKeys) {
        await transaction.rolePermission.deleteMany({ where: { roleId, tenantId } });
      }
      const role = await transaction.role.update({
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.permissionKeys
            ? {
                permissions: {
                  create: input.permissionKeys.map((permissionKey) => ({ permissionKey })),
                },
              }
            : {}),
        },
        select: roleSelect,
        where: { id: roleId },
      });
      await writeAccessChange(transaction, {
        action: "role.update",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: role.id,
        entityType: "role",
        payload: { after: mapRole(role), before: mapRole(before) },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapRole(role);
    });
  }

  async createMembership(
    tenantId: string,
    input: CreateMembership,
    context?: AccessMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const membership = await transaction.tenantMembership.create({
        data: {
          allOutlets: input.allOutlets,
          tenantId,
          userId: input.userId,
          roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
          assignments: { create: input.outletIds.map((outletId) => ({ outletId })) },
        },
        select: membershipSelect,
      });
      await writeAccessChange(transaction, {
        action: "membership.create",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: membership.id,
        entityType: "membership",
        payload: { after: mapMembership(membership) },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapMembership(membership);
    });
  }

  async updateMembership(
    tenantId: string,
    membershipId: string,
    input: UpdateMembership,
    context?: AccessMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.tenantMembership.findUniqueOrThrow({
        select: membershipSelect,
        where: { tenantId_id: { id: membershipId, tenantId } },
      });
      if (input.roleIds)
        await transaction.userRole.deleteMany({ where: { membershipId, tenantId } });
      if (input.outletIds || input.allOutlets === true)
        await transaction.outletAssignment.deleteMany({ where: { membershipId, tenantId } });
      const membership = await transaction.tenantMembership.update({
        data: {
          ...(input.allOutlets !== undefined ? { allOutlets: input.allOutlets } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.roleIds
            ? { roles: { create: input.roleIds.map((roleId) => ({ roleId })) } }
            : {}),
          ...(input.outletIds
            ? {
                assignments: {
                  create: input.outletIds.map((outletId) => ({ outletId })),
                },
              }
            : {}),
        },
        select: membershipSelect,
        where: { id: membershipId },
      });
      await writeAccessChange(transaction, {
        action: "membership.update",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: membership.id,
        entityType: "membership",
        payload: { before: mapMembership(before), after: mapMembership(membership) },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapMembership(membership);
    });
  }

  async findAuthorization(userId: string, tenantId: string) {
    const membership = await getPrismaClient().tenantMembership.findUnique({
      select: {
        ...membershipSelect,
        tenant: { select: { status: true } },
        user: { select: { status: true } },
        roles: {
          select: {
            roleId: true,
            role: { select: { status: true, permissions: { select: { permissionKey: true } } } },
          },
        },
      },
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership) return null;
    const permissionKeys = [
      ...new Set(
        membership.roles.flatMap((link) =>
          link.role.status === "ACTIVE"
            ? link.role.permissions.map((item) => item.permissionKey as PermissionKey)
            : [],
        ),
      ),
    ].sort();
    return {
      ...mapMembership(membership),
      permissionKeys,
      tenantStatus: membership.tenant.status,
      userStatus: membership.user.status,
    };
  }

  async provisionTenantOwner(
    tenantId: string,
    userId: string,
    roles: SystemRoleDefinition[],
    context?: AccessMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      for (const definition of roles) {
        await transaction.role.upsert({
          create: {
            code: definition.code,
            isSystem: true,
            name: definition.name,
            tenantId,
            permissions: {
              create: definition.permissionKeys.map((permissionKey) => ({ permissionKey })),
            },
          },
          update: {},
          where: { tenantId_code: { code: definition.code, tenantId } },
        });
      }
      const ownerRole = await transaction.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "OWNER", tenantId } },
      });
      const membership = await transaction.tenantMembership.create({
        data: {
          allOutlets: true,
          tenantId,
          userId,
          roles: { create: { roleId: ownerRole.id } },
        },
        select: membershipSelect,
      });
      await writeAccessChange(transaction, {
        action: "membership.provision_owner",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: membership.id,
        entityType: "membership",
        payload: { after: mapMembership(membership) },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapMembership(membership);
    });
  }
}
