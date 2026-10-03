import type {
  ModuleKey,
  ModuleKind,
  ModuleTier,
  OrganizationUnitStatus,
  PlanCode,
  SubscriptionStatus,
} from "@merchant/contracts";
import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";
import type {
  EffectiveEntitlementRow,
  PackageCapability,
  PackageLimit,
  TargetOverride,
} from "./effective-entitlements.js";

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
  /** Newest published version of the package with this code; null when none is published. */
  publishedVersion: { id: string; version: number } | null;
  status: OrganizationUnitStatus;
};

export type SubscriptionRecord = {
  createdAt: Date;
  cycleEndsAt: Date | null;
  cycleStartsAt: Date;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  id: string;
  /** What the bought package version contains. */
  capabilities: PackageCapability[];
  limits: PackageLimit[];
  modules: Array<{ moduleKey: ModuleKey; tier: ModuleTier }>;
  packageVersion: number;
  planCode: PlanCode;
  planId: string;
  planName: string;
  startsAt: Date;
  status: SubscriptionStatus;
  tenantId: string;
  updatedAt: Date;
};

/** A module override. It applies from `effectiveAt` until `endsAt` (null: until changed). */
export type EntitlementOverrideRecord = {
  actorId: string | null;
  effectiveAt: Date;
  enabled: boolean;
  endsAt: Date | null;
  moduleKey: ModuleKey;
  reason: string;
};

export type EntitlementStateRecord = {
  modules: ModuleRecord[];
  overrides: EntitlementOverrideRecord[];
  /** Capability and limit overrides that have not ended yet. */
  targetOverrides: TargetOverride[];
  subscription: SubscriptionRecord | null;
  tenant: { id: string; status: OrganizationUnitStatus } | null;
};

export type ReplaceSubscriptionRecordInput = {
  cycleEndsAt: Date | null;
  cycleStartsAt: Date;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  packageVersionId: string;
  planId: string;
  startsAt: Date;
  status: SubscriptionStatus;
};

export interface EntitlementRepository {
  findPlanByCode(code: PlanCode): Promise<PlanRecord | null>;
  getState(tenantId: string): Promise<EntitlementStateRecord>;
  listTenantIds(): Promise<string[]>;
  replaceSubscription(
    tenantId: string,
    input: ReplaceSubscriptionRecordInput,
    context?: EntitlementMutationContext,
  ): Promise<SubscriptionRecord>;
  /** Replaces the tenant's projection rows with `rows`. */
  saveEffectiveEntitlements(
    tenantId: string,
    rows: readonly EffectiveEntitlementRow[],
    computedAt: Date,
  ): Promise<void>;
  upsertEntitlement(
    tenantId: string,
    input: { enabled: boolean; endsAt: Date | null; moduleKey: ModuleKey; reason: string },
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
  cycleEndsAt: true,
  cycleStartsAt: true,
  endsAt: true,
  graceEndsAt: true,
  id: true,
  packageVersion: {
    select: {
      capabilities: {
        orderBy: { capabilityKey: "asc" as const },
        select: { capabilityKey: true, included: true },
      },
      limits: {
        orderBy: { dimensionKey: "asc" as const },
        select: { dimensionKey: true, unlimited: true, value: true },
      },
      modules: {
        orderBy: { moduleKey: "asc" as const },
        select: { moduleKey: true, tier: true },
      },
      version: true,
    },
  },
  plan: { select: planSelect },
  planId: true,
  startsAt: true,
  status: true,
  tenantId: true,
  updatedAt: true,
} as const;

const overrideSelect = {
  actorId: true,
  endsAt: true,
  id: true,
  operation: true,
  reason: true,
  startsAt: true,
  targetKey: true,
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

function mapPlan(
  record: {
    code: string;
    id: string;
    modules: Array<{ moduleKey: string }>;
    name: string;
    status: OrganizationUnitStatus;
  },
  publishedVersion: PlanRecord["publishedVersion"],
): PlanRecord {
  return {
    code: record.code as PlanCode,
    id: record.id,
    moduleKeys: record.modules.map((item) => item.moduleKey as ModuleKey),
    name: record.name,
    publishedVersion,
    status: record.status,
  };
}

function mapSubscription(record: {
  createdAt: Date;
  cycleEndsAt: Date | null;
  cycleStartsAt: Date;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  id: string;
  packageVersion: {
    capabilities: PackageCapability[];
    limits: PackageLimit[];
    modules: Array<{ moduleKey: string; tier: ModuleTier }>;
    version: number;
  };
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
    cycleEndsAt: record.cycleEndsAt,
    cycleStartsAt: record.cycleStartsAt,
    endsAt: record.endsAt,
    graceEndsAt: record.graceEndsAt,
    id: record.id,
    capabilities: record.packageVersion.capabilities,
    limits: record.packageVersion.limits,
    // Modules and tiers come from the package version that was bought, not from the plan.
    modules: record.packageVersion.modules.map((item) => ({
      moduleKey: item.moduleKey as ModuleKey,
      tier: item.tier,
    })),
    packageVersion: record.packageVersion.version,
    planCode: record.plan.code as PlanCode,
    planId: record.planId,
    planName: record.plan.name,
    startsAt: record.startsAt,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt,
  };
}

function mapOverride(record: {
  actorId: string | null;
  endsAt: Date | null;
  operation: string;
  reason: string;
  startsAt: Date;
  targetKey: string;
}): EntitlementOverrideRecord {
  return {
    actorId: record.actorId,
    effectiveAt: record.startsAt,
    enabled: record.operation === "GRANT",
    endsAt: record.endsAt,
    moduleKey: record.targetKey as ModuleKey,
    reason: record.reason,
  };
}

function serializeOverride(record: EntitlementOverrideRecord) {
  return {
    ...record,
    effectiveAt: record.effectiveAt.toISOString(),
    endsAt: record.endsAt?.toISOString() ?? null,
  };
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
    payload: Record<string, unknown>;
    requestId?: string;
    tenantId: string;
  },
) {
  const payload = buildAuditPayload(options.payload);
  await transaction.auditLog.create({
    data: {
      action: options.action,
      ...(options.actorId ? { actorId: options.actorId } : {}),
      entityId: options.entityId,
      entityType: options.entityType,
      metadata: buildAuditMetadata(options.action, payload),
      ...(options.requestId ? { requestId: options.requestId } : {}),
      tenantId: options.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      aggregateId: options.entityId,
      aggregateType: options.entityType,
      payload,
      tenantId: options.tenantId,
      type: `subscription.${options.entityType}.${options.action.split(".").at(-1)}`,
    },
  });
}

@Injectable()
export class PrismaEntitlementRepository implements EntitlementRepository {
  async findPlanByCode(code: PlanCode) {
    const [plan, publishedVersion] = await Promise.all([
      getPrismaClient().plan.findUnique({ select: planSelect, where: { code } }),
      // The package carries the plan's code as its key (SCH-03 transition).
      getPrismaClient().corePackageVersion.findFirst({
        orderBy: { version: "desc" },
        select: { id: true, version: true },
        where: { package: { key: code }, status: "PUBLISHED" },
      }),
    ]);
    return plan ? mapPlan(plan, publishedVersion) : null;
  }

  async getState(tenantId: string): Promise<EntitlementStateRecord> {
    const notEnded = { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] };
    const [tenant, modules, subscription, overrides, targetOverrides] = await Promise.all([
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
      // Every module override that has not ended yet; the service picks what applies at a given time.
      getPrismaClient().coreEntitlementOverride.findMany({
        orderBy: [{ targetKey: "asc" }, { startsAt: "asc" }],
        select: overrideSelect,
        where: { ...notEnded, targetType: "MODULE", tenantId },
      }),
      getPrismaClient().coreEntitlementOverride.findMany({
        orderBy: { startsAt: "asc" },
        select: {
          endsAt: true,
          operation: true,
          startsAt: true,
          targetKey: true,
          targetType: true,
          value: true,
        },
        where: { ...notEnded, targetType: { in: ["CAPABILITY", "LIMIT"] }, tenantId },
      }),
    ]);
    return {
      modules: modules.map(mapModule),
      overrides: overrides.map(mapOverride),
      subscription: subscription ? mapSubscription(subscription) : null,
      targetOverrides: targetOverrides.map((item) => ({
        effectiveAt: item.startsAt,
        endsAt: item.endsAt,
        operation: item.operation,
        targetKey: item.targetKey,
        targetType: item.targetType as "CAPABILITY" | "LIMIT",
        value: item.value,
      })),
      tenant,
    };
  }

  async listTenantIds() {
    const tenants = await getPrismaClient().tenant.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return tenants.map((tenant) => tenant.id);
  }

  async saveEffectiveEntitlements(
    tenantId: string,
    rows: readonly EffectiveEntitlementRow[],
    computedAt: Date,
  ) {
    await getPrismaClient().$transaction(async (transaction) => {
      await transaction.coreEffectiveEntitlement.deleteMany({ where: { tenantId } });
      if (rows.length === 0) return;
      await transaction.coreEffectiveEntitlement.createMany({
        data: rows.map((row) => ({
          capabilities: row.capabilities,
          computedAt,
          // BigInt has no JSON form; limits are stored as decimal strings.
          limits: row.limits.map((limit) => ({
            dimensionKey: limit.dimensionKey,
            source: limit.source,
            unlimited: limit.unlimited,
            value: limit.value?.toString() ?? null,
          })),
          moduleKey: row.moduleKey,
          tenantId,
          tier: row.tier,
        })),
      });
    });
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
    input: { enabled: boolean; endsAt: Date | null; moduleKey: ModuleKey; reason: string },
    context?: EntitlementMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const now = new Date();
      const target = { targetKey: input.moduleKey, targetType: "MODULE" as const, tenantId };
      // The decisions still in force are closed, not overwritten: they stay as history.
      const current = await transaction.coreEntitlementOverride.findMany({
        orderBy: { startsAt: "asc" },
        select: overrideSelect,
        where: { ...target, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      });
      for (const previous of current) {
        // `endsAt` must stay after `startsAt`, also for a decision made this very millisecond.
        const closedAt = new Date(Math.max(now.getTime(), previous.startsAt.getTime() + 1));
        await transaction.coreEntitlementOverride.update({
          data: { endsAt: closedAt },
          where: { id: previous.id },
        });
      }
      const created = await transaction.coreEntitlementOverride.create({
        data: {
          ...target,
          ...(context?.actorId ? { actorId: context.actorId } : {}),
          endsAt: input.endsAt,
          operation: input.enabled ? "GRANT" : "REVOKE",
          reason: input.reason,
          startsAt: new Date(
            Math.max(now.getTime(), ...current.map((item) => item.startsAt.getTime() + 1)),
          ),
        },
        select: overrideSelect,
      });
      const mapped = mapOverride(created);
      const before = current.at(-1);
      await writeChange(transaction, {
        action: "entitlement.override",
        ...(context?.actorId ? { actorId: context.actorId } : {}),
        entityId: created.id,
        entityType: "entitlement",
        payload: {
          after: serializeOverride(mapped),
          ...(before ? { before: serializeOverride(mapOverride(before)) } : {}),
        },
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        tenantId,
      });
      return mapped;
    });
  }
}
