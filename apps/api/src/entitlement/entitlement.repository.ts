import type {
  ModuleKey,
  ModuleKind,
  OrganizationUnitStatus,
  PlanCode,
  SubscriptionStatus,
} from "@merchant/contracts";
import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type EntitlementMutationContext = { actorId?: string; requestId?: string };

export type ModuleRecord = {
  dependencyKeys: ModuleKey[];
  key: ModuleKey;
  kind: ModuleKind;
  name: string;
  status: OrganizationUnitStatus;
};

export type PlanRecord = {
  code: PlanCode;
  id: string;
  moduleKeys: ModuleKey[];
  name: string;
  status: OrganizationUnitStatus;
};

export type SubscriptionRecord = {
  createdAt: Date;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  id: string;
  planCode: PlanCode;
  planId: string;
  planModuleKeys: ModuleKey[];
  planName: string;
  startsAt: Date;
  status: SubscriptionStatus;
  tenantId: string;
  updatedAt: Date;
};

export type EntitlementOverrideRecord = {
  actorId: string | null;
  effectiveAt: Date;
  enabled: boolean;
  moduleKey: ModuleKey;
  reason: string;
};

export type EntitlementStateRecord = {
  modules: ModuleRecord[];
  overrides: EntitlementOverrideRecord[];
  subscription: SubscriptionRecord | null;
  tenant: { id: string; status: OrganizationUnitStatus } | null;
};

export type ReplaceSubscriptionRecordInput = {
  endsAt: Date | null;
  graceEndsAt: Date | null;
  planId: string;
  startsAt: Date;
  status: SubscriptionStatus;
};

export interface EntitlementRepository {
  findPlanByCode(code: PlanCode): Promise<PlanRecord | null>;
  getState(tenantId: string): Promise<EntitlementStateRecord>;
  replaceSubscription(
    tenantId: string,
    input: ReplaceSubscriptionRecordInput,
    context?: EntitlementMutationContext,
  ): Promise<SubscriptionRecord>;
  upsertEntitlement(
    tenantId: string,
    input: { enabled: boolean; moduleKey: ModuleKey; reason: string },
    context?: EntitlementMutationContext,
  ): Promise<EntitlementOverrideRecord>;
}

export const ENTITLEMENT_REPOSITORY = Symbol("ENTITLEMENT_REPOSITORY");

const moduleSelect = {
  dependencies: {
    orderBy: { dependencyKey: "asc" as const },
    select: { dependencyKey: true },
  },
  key: true,
  kind: true,
  name: true,
  status: true,
} as const;

const planSelect = {
  code: true,
  id: true,
  modules: { orderBy: { moduleKey: "asc" as const }, select: { moduleKey: true } },
  name: true,
  status: true,
} as const;

const subscriptionSelect = {
  createdAt: true,
  endsAt: true,
  graceEndsAt: true,
  id: true,
  plan: { select: planSelect },
  planId: true,
  startsAt: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const overrideSelect = {
  actorId: true,
  effectiveAt: true,
  enabled: true,
  moduleKey: true,
  reason: true,
} as const;

function mapModule(record: {
  dependencies: Array<{ dependencyKey: string }>;
  key: string;
  kind: ModuleKind;
  name: string;
  status: OrganizationUnitStatus;
}): ModuleRecord {
  return {
    dependencyKeys: record.dependencies.map((item) => item.dependencyKey as ModuleKey),
    key: record.key as ModuleKey,
    kind: record.kind,
    name: record.name,
    status: record.status,
  };
}

function mapPlan(record: {
  code: string;
  id: string;
  modules: Array<{ moduleKey: string }>;
  name: string;
  status: OrganizationUnitStatus;
}): PlanRecord {
  return {
    code: record.code as PlanCode,
    id: record.id,
    moduleKeys: record.modules.map((item) => item.moduleKey as ModuleKey),
    name: record.name,
    status: record.status,
  };
}

function mapSubscription(record: {
  createdAt: Date;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  id: string;
  plan: {
    code: string;
    id: string;
    modules: Array<{ moduleKey: string }>;
    name: string;
  };
  planId: string;
  startsAt: Date;
  status: SubscriptionStatus;
  tenantId: string;
  updatedAt: Date;
}): SubscriptionRecord {
  return {
    createdAt: record.createdAt,
    endsAt: record.endsAt,
    graceEndsAt: record.graceEndsAt,
    id: record.id,
    planCode: record.plan.code as PlanCode,
    planId: record.planId,
    planModuleKeys: record.plan.modules.map((item) => item.moduleKey as ModuleKey),
    planName: record.plan.name,
    startsAt: record.startsAt,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt,
  };
}

function mapOverride(record: {
  actorId: string | null;
  effectiveAt: Date;
  enabled: boolean;
  moduleKey: string;
  reason: string;
}): EntitlementOverrideRecord {
  return { ...record, moduleKey: record.moduleKey as ModuleKey };
}

function serializeSubscription(record: SubscriptionRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    endsAt: record.endsAt?.toISOString() ?? null,
    graceEndsAt: record.graceEndsAt?.toISOString() ?? null,
    startsAt: record.startsAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

type TransactionClient = Pick<DatabaseClient, "auditLog" | "outboxEvent">;

async function writeChange(
  transaction: TransactionClient,
  options: {
    action: string;
    actorId?: string;
    entityId: string;
    entityType: "entitlement" | "subscription";
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
      type: `subscription.${options.entityType}.${options.action.split(".").at(-1)}`,
    },
  });
}

@Injectable()
export class PrismaEntitlementRepository implements EntitlementRepository {
  async findPlanByCode(code: PlanCode) {
    const plan = await getPrismaClient().plan.findUnique({
      select: planSelect,
      where: { code },
    });
    return plan ? mapPlan(plan) : null;
  }

  async getState(tenantId: string): Promise<EntitlementStateRecord> {
    const [tenant, modules, subscription, overrides] = await Promise.all([
      getPrismaClient().tenant.findUnique({
        select: { id: true, status: true },
        where: { id: tenantId },
      }),
      getPrismaClient().moduleDefinition.findMany({
        orderBy: { key: "asc" },
        select: moduleSelect,
      }),
      getPrismaClient().subscription.findFirst({
        select: subscriptionSelect,
        where: { supersededAt: null, tenantId },
      }),
      getPrismaClient().tenantEntitlement.findMany({
        orderBy: { moduleKey: "asc" },
        select: overrideSelect,
        where: { tenantId },
      }),
    ]);
    return {
      modules: modules.map(mapModule),
      overrides: overrides.map(mapOverride),
      subscription: subscription ? mapSubscription(subscription) : null,
      tenant,
    };
  }

  async replaceSubscription(
    tenantId: string,
    input: ReplaceSubscriptionRecordInput,
    context?: EntitlementMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const previous = await transaction.subscription.findFirst({
        select: subscriptionSelect,
        where: { supersededAt: null, tenantId },
      });
      const changedAt = new Date();
      if (previous) {
        await transaction.subscription.update({
          data: { supersededAt: changedAt },
          where: { id: previous.id },
        });
      }
      const created = await transaction.subscription.create({
        data: { ...input, tenantId },
        select: subscriptionSelect,
      });
      const subscription = mapSubscription(created);
      await writeChange(transaction, {
        action: "subscription.replace",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: subscription.id,
        entityType: "subscription",
        payload: {
          after: serializeSubscription(subscription),
          ...(previous ? { before: serializeSubscription(mapSubscription(previous)) } : {}),
        },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return subscription;
    });
  }

  async upsertEntitlement(
    tenantId: string,
    input: { enabled: boolean; moduleKey: ModuleKey; reason: string },
    context?: EntitlementMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.tenantEntitlement.findUnique({
        select: overrideSelect,
        where: { tenantId_moduleKey: { moduleKey: input.moduleKey, tenantId } },
      });
      const effectiveAt = new Date();
      const entitlement = await transaction.tenantEntitlement.upsert({
        create: {
          ...(context?.actorId ? { actorId: context.actorId } : {}),
          effectiveAt,
          enabled: input.enabled,
          moduleKey: input.moduleKey,
          reason: input.reason,
          tenantId,
        },
        update: {
          actorId: context?.actorId ?? null,
          effectiveAt,
          enabled: input.enabled,
          reason: input.reason,
        },
        select: overrideSelect,
        where: { tenantId_moduleKey: { moduleKey: input.moduleKey, tenantId } },
      });
      const mapped = mapOverride(entitlement);
      await writeChange(transaction, {
        action: "entitlement.override",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: (
          await transaction.tenantEntitlement.findUniqueOrThrow({
            select: { id: true },
            where: { tenantId_moduleKey: { moduleKey: input.moduleKey, tenantId } },
          })
        ).id,
        entityType: "entitlement",
        payload: {
          after: { ...mapped, effectiveAt: mapped.effectiveAt.toISOString() },
          ...(before
            ? { before: { ...mapOverride(before), effectiveAt: before.effectiveAt.toISOString() } }
            : {}),
        },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapped;
    });
  }
}
