import {
  entitlementSnapshotSchema,
  replaceSubscriptionSchema,
  setTenantEntitlementSchema,
  type EntitlementSnapshot,
  type ModuleEntitlement,
  type ModuleKey,
  type ReplaceSubscription,
  type SetTenantEntitlement,
  type Subscription,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  ENTITLEMENT_REPOSITORY,
  type EntitlementMutationContext,
  type EntitlementOverrideRecord,
  type EntitlementRepository,
  type EntitlementStateRecord,
  type SubscriptionRecord,
} from "./entitlement.repository.js";

function notFound(code: string, message: string) {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

function invalid(message: string) {
  return new BadRequestException({ code: "SUBSCRIPTION_INVALID", message });
}

function denied(code: "MODULE_NOT_ENTITLED" | "SUBSCRIPTION_INACTIVE") {
  return new ForbiddenException({
    code,
    message:
      code === "MODULE_NOT_ENTITLED"
        ? "Modul ini tidak tersedia untuk tenant aktif."
        : "Subscription tenant tidak aktif.",
  });
}

function toSubscription(record: SubscriptionRecord): Subscription {
  return {
    createdAt: record.createdAt.toISOString(),
    endsAt: record.endsAt?.toISOString() ?? null,
    graceEndsAt: record.graceEndsAt?.toISOString() ?? null,
    id: record.id,
    planCode: record.planCode,
    planName: record.planName,
    startsAt: record.startsAt.toISOString(),
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isSubscriptionUsable(record: SubscriptionRecord | null, now: Date) {
  if (!record || record.startsAt > now) return false;
  if (record.status === "TRIAL" || record.status === "ACTIVE") {
    return record.endsAt === null || record.endsAt > now;
  }
  if (record.status === "GRACE") {
    return record.graceEndsAt !== null && record.graceEndsAt > now;
  }
  return false;
}

function toOverride(record: EntitlementOverrideRecord | undefined) {
  return record
    ? {
        actorId: record.actorId,
        effectiveAt: record.effectiveAt.toISOString(),
        enabled: record.enabled,
        reason: record.reason,
      }
    : null;
}

@Injectable()
export class EntitlementService {
  constructor(
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly repository: EntitlementRepository,
  ) {}

  private resolveState(state: EntitlementStateRecord, now: Date): EntitlementSnapshot {
    const subscriptionUsable =
      state.tenant?.status === "ACTIVE" && isSubscriptionUsable(state.subscription, now);
    const planModules = new Set(state.subscription?.planModuleKeys ?? []);
    const overrides = new Map(state.overrides.map((item) => [item.moduleKey, item]));
    const decisions = new Map<ModuleKey, ModuleEntitlement>();

    for (const module of state.modules) {
      const planDefault = planModules.has(module.key);
      const override = overrides.get(module.key);
      let enabled = false;
      let source: ModuleEntitlement["source"] = "NONE";
      let reason = "Subscription tenant tidak aktif.";

      if (module.status !== "ACTIVE") {
        reason = "Module dinonaktifkan pada katalog platform.";
      } else if (subscriptionUsable && module.kind === "CORE") {
        enabled = true;
        source = "CORE";
        reason = "Core domain selalu aktif untuk subscription yang dapat digunakan.";
      } else if (subscriptionUsable && override) {
        enabled = override.enabled;
        source = "OVERRIDE";
        reason = override.reason;
      } else if (subscriptionUsable && planDefault) {
        enabled = true;
        source = "PLAN";
        reason = "Aktif dari paket subscription.";
      } else if (subscriptionUsable) {
        reason = "Tidak termasuk paket dan tidak memiliki override aktif.";
      }

      decisions.set(module.key, {
        enabled,
        key: module.key,
        kind: module.kind,
        name: module.name,
        override: toOverride(override),
        planDefault,
        reason,
        requiredBy: [],
        source,
      });
    }

    if (subscriptionUsable) {
      const modules = new Map(state.modules.map((module) => [module.key, module]));
      const visitDependencies = (moduleKey: ModuleKey, visited: Set<ModuleKey>) => {
        if (visited.has(moduleKey)) return;
        visited.add(moduleKey);
        const module = modules.get(moduleKey);
        if (!module) return;
        for (const dependencyKey of module.dependencyKeys) {
          const dependency = decisions.get(dependencyKey);
          if (!dependency) continue;
          if (!dependency.enabled) {
            dependency.enabled = true;
            dependency.source = "DEPENDENCY";
            dependency.reason = `Dibutuhkan oleh ${module.name}.`;
          }
          if (!dependency.requiredBy.includes(moduleKey)) dependency.requiredBy.push(moduleKey);
          visitDependencies(dependencyKey, visited);
        }
      };

      for (const decision of decisions.values()) {
        if (decision.enabled) visitDependencies(decision.key, new Set());
      }
    }

    for (const decision of decisions.values()) decision.requiredBy.sort();

    return entitlementSnapshotSchema.parse({
      modules: [...decisions.values()].sort((left, right) => left.key.localeCompare(right.key)),
      subscription: state.subscription ? toSubscription(state.subscription) : null,
    });
  }

  private validateDates(input: ReplaceSubscription) {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    const graceEndsAt = input.graceEndsAt ? new Date(input.graceEndsAt) : null;
    if (endsAt && endsAt <= startsAt) invalid("Waktu berakhir harus setelah waktu mulai.");
    if (graceEndsAt && endsAt && graceEndsAt < endsAt)
      invalid("Batas grace period tidak boleh sebelum waktu berakhir.");
    if (input.status === "GRACE" && (!endsAt || !graceEndsAt))
      invalid("Subscription berstatus GRACE wajib memiliki endsAt dan graceEndsAt.");
    return { endsAt, graceEndsAt, startsAt };
  }

  async getSnapshot(tenantId: string, now = new Date()) {
    const state = await this.repository.getState(tenantId);
    if (!state.tenant) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    return this.resolveState(state, now);
  }

  async replaceSubscription(
    tenantId: string,
    input: ReplaceSubscription,
    context?: EntitlementMutationContext,
  ) {
    const parsed = replaceSubscriptionSchema.parse(input);
    const state = await this.repository.getState(tenantId);
    if (!state.tenant) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    if (state.tenant.status !== "ACTIVE") throw conflict("TENANT_INACTIVE", "Tenant tidak aktif.");
    const plan = await this.repository.findPlanByCode(parsed.planCode);
    if (!plan) throw notFound("PLAN_NOT_FOUND", "Paket subscription tidak ditemukan.");
    if (plan.status !== "ACTIVE") throw conflict("PLAN_INACTIVE", "Paket tidak aktif.");
    const dates = this.validateDates(parsed);
    await this.repository.replaceSubscription(
      tenantId,
      { ...dates, planId: plan.id, status: parsed.status },
      context,
    );
    return this.getSnapshot(tenantId);
  }

  async setEntitlement(
    tenantId: string,
    input: SetTenantEntitlement,
    context?: EntitlementMutationContext,
  ) {
    const parsed = setTenantEntitlementSchema.parse(input);
    const state = await this.repository.getState(tenantId);
    if (!state.tenant) throw notFound("TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
    if (!state.subscription)
      throw conflict("SUBSCRIPTION_REQUIRED", "Tenant belum memiliki subscription.");
    const module = state.modules.find((item) => item.key === parsed.moduleKey);
    if (!module) throw notFound("MODULE_NOT_FOUND", "Module tidak ditemukan.");
    if (module.status !== "ACTIVE") throw conflict("MODULE_INACTIVE", "Module tidak aktif.");
    if (module.kind === "CORE")
      throw conflict("CORE_MODULE_IMMUTABLE", "Core module tidak dapat dioverride.");

    const pending: EntitlementOverrideRecord = {
      actorId: context?.actorId ?? null,
      effectiveAt: new Date(),
      enabled: parsed.enabled,
      moduleKey: parsed.moduleKey,
      reason: parsed.reason,
    };
    const pendingState = {
      ...state,
      overrides: [
        ...state.overrides.filter((item) => item.moduleKey !== parsed.moduleKey),
        pending,
      ],
    };
    const pendingDecision = this.resolveState(pendingState, new Date()).modules.find(
      (item) => item.key === parsed.moduleKey,
    );
    if (!parsed.enabled && pendingDecision?.enabled) {
      throw conflict(
        "ENTITLEMENT_DEPENDENCY_CONFLICT",
        `Module masih dibutuhkan oleh: ${pendingDecision.requiredBy.join(", ")}.`,
      );
    }

    await this.repository.upsertEntitlement(tenantId, parsed, context);
    return this.getSnapshot(tenantId);
  }

  async requireAccess(tenantId: string, moduleKey?: ModuleKey, now = new Date()) {
    const state = await this.repository.getState(tenantId);
    if (
      !state.tenant ||
      state.tenant.status !== "ACTIVE" ||
      !isSubscriptionUsable(state.subscription, now)
    ) {
      throw denied("SUBSCRIPTION_INACTIVE");
    }
    const snapshot = this.resolveState(state, now);
    if (moduleKey && !snapshot.modules.find((item) => item.key === moduleKey)?.enabled) {
      throw denied("MODULE_NOT_ENTITLED");
    }
    return snapshot;
  }
}
