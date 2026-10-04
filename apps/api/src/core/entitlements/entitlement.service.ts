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
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { MODULE_MANIFEST_REGISTRY, ModuleManifestRegistry } from "../manifest/public.js";
import { assertAccess, evaluateAccess } from "./access-evaluator.js";
import {
  buildEffectiveEntitlementRows,
  effectiveCapabilities,
  effectiveLimits,
} from "./effective-entitlements.js";
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

function invalid(message: string): never {
  throw new BadRequestException({ code: "SUBSCRIPTION_INVALID", message });
}

function toSubscription(record: SubscriptionRecord): Subscription {
  return {
    createdAt: record.createdAt.toISOString(),
    cycleEndsAt: record.cycleEndsAt?.toISOString() ?? null,
    cycleStartsAt: record.cycleStartsAt.toISOString(),
    endsAt: record.endsAt?.toISOString() ?? null,
    graceEndsAt: record.graceEndsAt?.toISOString() ?? null,
    id: record.id,
    packageVersion: record.packageVersion,
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
  // Canceled subscriptions run out the period that was paid for.
  if (record.status === "CANCELED_AT_PERIOD_END") {
    return record.endsAt !== null && record.endsAt > now;
  }
  if (record.status === "GRACE") {
    return record.graceEndsAt !== null && record.graceEndsAt > now;
  }
  return false;
}

/** The override in force for each module at `now`: started, not ended, newest wins. */
function overridesInForce(overrides: readonly EntitlementOverrideRecord[], now: Date) {
  const inForce = new Map<ModuleKey, EntitlementOverrideRecord>();
  for (const override of overrides) {
    if (override.effectiveAt > now) continue;
    if (override.endsAt !== null && override.endsAt <= now) continue;
    const known = inForce.get(override.moduleKey);
    if (!known || known.effectiveAt <= override.effectiveAt) {
      inForce.set(override.moduleKey, override);
    }
  }
  return inForce;
}

function toOverride(record: EntitlementOverrideRecord | undefined) {
  return record
    ? {
        actorId: record.actorId,
        effectiveAt: record.effectiveAt.toISOString(),
        enabled: record.enabled,
        endsAt: record.endsAt?.toISOString() ?? null,
        reason: record.reason,
      }
    : null;
}

@Injectable()
export class EntitlementService {
  constructor(
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly repository: EntitlementRepository,
    // Without manifests (unit tests) modules give no capabilities by default.
    @Optional()
    @Inject(MODULE_MANIFEST_REGISTRY)
    private readonly manifests: ModuleManifestRegistry = new ModuleManifestRegistry(),
  ) {}

  private resolveState(state: EntitlementStateRecord, now: Date): EntitlementSnapshot {
    const subscriptionUsable =
      state.tenant?.status === "ACTIVE" && isSubscriptionUsable(state.subscription, now);
    const planTiers = new Map(
      (state.subscription?.modules ?? []).map((item) => [item.moduleKey, item.tier]),
    );
    const overrides = overridesInForce(state.overrides, now);
    const decisions = new Map<ModuleKey, ModuleEntitlement>();

    for (const module of state.modules) {
      const planDefault = planTiers.has(module.key);
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
        // The package sets the tier; a module switched on some other way gets Basic.
        tier: enabled ? (planTiers.get(module.key) ?? "BASIC") : null,
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
            dependency.tier = planTiers.get(dependencyKey) ?? "BASIC";
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
    if (input.status === "CANCELED_AT_PERIOD_END" && !endsAt)
      invalid("A subscription canceled at period end needs endsAt.");
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
    if (!plan.publishedVersion) {
      throw conflict("PACKAGE_VERSION_NOT_PUBLISHED", "This package has no published version.");
    }
    const dates = this.validateDates(parsed);
    await this.repository.replaceSubscription(
      tenantId,
      {
        ...dates,
        // The first billing cycle is the subscription period itself.
        cycleEndsAt: dates.endsAt,
        cycleStartsAt: dates.startsAt,
        packageVersionId: plan.publishedVersion.id,
        status: parsed.status,
      },
      context,
    );
    await this.rebuildProjection(tenantId);
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

    const now = new Date();
    const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
    if (endsAt && endsAt <= now) {
      throw new BadRequestException({
        code: "ENTITLEMENT_OVERRIDE_INVALID",
        message: "An override must end in the future.",
      });
    }
    const pending: EntitlementOverrideRecord = {
      actorId: context?.actorId ?? null,
      effectiveAt: now,
      enabled: parsed.enabled,
      endsAt,
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
    const pendingDecision = this.resolveState(pendingState, now).modules.find(
      (item) => item.key === parsed.moduleKey,
    );
    if (!parsed.enabled && pendingDecision?.enabled) {
      throw conflict(
        "ENTITLEMENT_DEPENDENCY_CONFLICT",
        `Module masih dibutuhkan oleh: ${pendingDecision.requiredBy.join(", ")}.`,
      );
    }

    await this.repository.upsertEntitlement(
      tenantId,
      { enabled: parsed.enabled, endsAt, moduleKey: parsed.moduleKey, reason: parsed.reason },
      context,
    );
    await this.rebuildProjection(tenantId);
    return this.getSnapshot(tenantId);
  }

  /**
   * What the access evaluator needs to know about the workspace's subscription
   * and, when a module is named, whether that module is entitled.
   */
  async describeAccess(tenantId: string, moduleKey?: ModuleKey, now = new Date()) {
    const state = await this.repository.getState(tenantId);
    const subscriptionUsable =
      state.tenant?.status === "ACTIVE" && isSubscriptionUsable(state.subscription, now);
    const snapshot = this.resolveState(state, now);
    const decision = moduleKey
      ? snapshot.modules.find((item) => item.key === moduleKey)
      : undefined;
    return {
      capabilities: new Set(
        subscriptionUsable && state.subscription
          ? effectiveCapabilities(
              state.subscription.capabilities,
              state.targetOverrides,
              now,
              this.tierDefaults(snapshot),
            )
          : [],
      ),
      // Core modules are part of every workspace; only commercial ones are installed.
      ...(decision?.kind === "COMMERCIAL"
        ? {
            installation:
              state.installations.find((item) => item.moduleKey === decision.key)?.status ??
              ("NOT_INSTALLED" as const),
          }
        : {}),
      ...(moduleKey
        ? { module: { entitled: decision?.enabled === true, tier: decision?.tier ?? null } }
        : {}),
      snapshot,
      subscriptionUsable,
    };
  }

  /** Capabilities the enabled modules give at their tier, according to their manifests. */
  private tierDefaults(snapshot: EntitlementSnapshot) {
    return snapshot.modules.flatMap((item) =>
      item.enabled && item.tier ? this.manifests.capabilitiesAt(item.key, item.tier) : [],
    );
  }

  /**
   * Rewrites the tenant's rows in `core_effective_entitlements` from the
   * subscription, its package version, and the overrides in force at `now`.
   */
  async rebuildProjection(tenantId: string, now = new Date()) {
    const state = await this.repository.getState(tenantId);
    const snapshot = this.resolveState(state, now);
    const usable =
      state.tenant?.status === "ACTIVE" && isSubscriptionUsable(state.subscription, now);
    const rows =
      usable && state.subscription
        ? buildEffectiveEntitlementRows(
            snapshot.modules
              .filter((item) => item.enabled && item.tier !== null)
              .map((item) => ({ moduleKey: item.key, tier: item.tier ?? "BASIC" })),
            effectiveCapabilities(
              state.subscription.capabilities,
              state.targetOverrides,
              now,
              this.tierDefaults(snapshot),
            ),
            effectiveLimits(state.subscription.limits, state.targetOverrides, now),
            (key) => this.manifests.ownerOf(key),
          )
        : [];
    await this.repository.saveEffectiveEntitlements(tenantId, rows, now);
    return rows;
  }

  /**
   * The limits in force for a workspace and its billing cycle, for metering.
   * A workspace whose subscription cannot be used has no limits to measure against.
   */
  async limitsInForce(tenantId: string, now = new Date()) {
    const state = await this.repository.getState(tenantId);
    const usable =
      state.tenant?.status === "ACTIVE" && isSubscriptionUsable(state.subscription, now);
    return {
      cycle: state.subscription
        ? { endsAt: state.subscription.cycleEndsAt, startsAt: state.subscription.cycleStartsAt }
        : null,
      limits:
        usable && state.subscription
          ? effectiveLimits(state.subscription.limits, state.targetOverrides, now)
          : [],
    };
  }

  /** Rebuilds the projection for every tenant; safe to run at any time. */
  async rebuildAllProjections(now = new Date()) {
    const tenantIds = await this.repository.listTenantIds();
    for (const tenantId of tenantIds) await this.rebuildProjection(tenantId, now);
    return tenantIds.length;
  }

  /** Subscription and module check on its own, for callers outside a request guard. */
  async requireAccess(tenantId: string, moduleKey?: ModuleKey, now = new Date()) {
    const { snapshot, ...facts } = await this.describeAccess(tenantId, moduleKey, now);
    assertAccess(
      evaluateAccess(
        { allLocations: true, membershipActive: true, permissionKeys: [], ...facts },
        moduleKey ? { moduleKey } : {},
      ),
    );
    return snapshot;
  }
}
