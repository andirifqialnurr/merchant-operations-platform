import assert from "node:assert/strict";
import test from "node:test";

import { MODULES, PLAN_CODES, type ModuleKey, type PlanCode } from "@merchant/contracts";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";

import type {
  EntitlementMutationContext,
  EntitlementOverrideRecord,
  EntitlementRepository,
  EntitlementStateRecord,
  PlanRecord,
  ReplaceSubscriptionRecordInput,
  SubscriptionRecord,
} from "./entitlement.repository.js";
import { EntitlementService } from "./entitlement.service.js";

const TENANT_ID = "019f7900-0000-7000-8000-000000000101";
const TENANT_B_ID = "019f7900-0000-7000-8000-000000000103";
const ACTOR_ID = "019f7900-0000-7000-8000-000000000102";

const moduleDefinitions: EntitlementStateRecord["modules"] = [
  {
    dependencyKeys: [],
    key: MODULES.coreTenancy,
    kind: "CORE",
    name: "Tenancy Core",
    status: "ACTIVE",
  },
  {
    dependencyKeys: [],
    key: MODULES.coreCatalog,
    kind: "CORE",
    name: "Catalog Core",
    status: "ACTIVE",
  },
  {
    dependencyKeys: [MODULES.coreCatalog],
    key: MODULES.cafeProfile,
    kind: "COMMERCIAL",
    name: "Cafe Profile",
    status: "ACTIVE",
  },
  {
    dependencyKeys: [MODULES.cafeProfile, MODULES.coreCatalog],
    key: MODULES.tableSelfOrder,
    kind: "COMMERCIAL",
    name: "Table Self-Order",
    status: "ACTIVE",
  },
  {
    dependencyKeys: [MODULES.coreCatalog],
    key: MODULES.inventoryBasic,
    kind: "COMMERCIAL",
    name: "Inventory Basic",
    status: "ACTIVE",
  },
];

const plans: PlanRecord[] = [
  {
    code: PLAN_CODES.profile,
    id: "019f7900-0000-7000-8000-000000000201",
    moduleKeys: [MODULES.cafeProfile],
    name: "Profile",
    publishedVersion: { id: "019f7900-0000-7000-8000-000000000401", version: 2 },
    status: "ACTIVE",
  },
  {
    code: PLAN_CODES.customModular,
    id: "019f7900-0000-7000-8000-000000000202",
    moduleKeys: [],
    name: "Custom Modular",
    publishedVersion: { id: "019f7900-0000-7000-8000-000000000402", version: 1 },
    status: "ACTIVE",
  },
];

class MemoryEntitlementRepository implements EntitlementRepository {
  readonly states: Record<string, EntitlementStateRecord> = {
    [TENANT_ID]: {
      modules: moduleDefinitions,
      overrides: [],
      subscription: null,
      tenant: { id: TENANT_ID, status: "ACTIVE" },
    },
    [TENANT_B_ID]: {
      modules: moduleDefinitions,
      overrides: [],
      subscription: null,
      tenant: { id: TENANT_B_ID, status: "ACTIVE" },
    },
  };

  get state() {
    return this.states[TENANT_ID]!;
  }

  async findPlanByCode(code: PlanCode) {
    return plans.find((plan) => plan.code === code) ?? null;
  }

  async getState(tenantId: string) {
    return (
      this.states[tenantId] ?? {
        modules: moduleDefinitions,
        overrides: [],
        subscription: null,
        tenant: null,
      }
    );
  }

  async replaceSubscription(tenantId: string, input: ReplaceSubscriptionRecordInput) {
    const plan = plans.find((item) => item.id === input.planId);
    assert.ok(plan);
    const now = new Date("2026-07-20T00:00:00.000Z");
    const subscription: SubscriptionRecord = {
      createdAt: now,
      cycleEndsAt: input.cycleEndsAt,
      cycleStartsAt: input.cycleStartsAt,
      endsAt: input.endsAt,
      graceEndsAt: input.graceEndsAt,
      id:
        tenantId === TENANT_ID
          ? "019f7900-0000-7000-8000-000000000301"
          : "019f7900-0000-7000-8000-000000000302",
      packageVersion:
        plans.find((item) => item.publishedVersion?.id === input.packageVersionId)?.publishedVersion
          ?.version ?? 0,
      planCode: plan.code,
      planId: plan.id,
      planModuleKeys: plan.moduleKeys,
      planName: plan.name,
      startsAt: input.startsAt,
      status: input.status,
      tenantId,
      updatedAt: now,
    };
    const state = this.states[tenantId];
    assert.ok(state);
    state.subscription = subscription;
    return subscription;
  }

  async upsertEntitlement(
    tenantId: string,
    input: { enabled: boolean; endsAt: Date | null; moduleKey: ModuleKey; reason: string },
    context?: EntitlementMutationContext,
  ) {
    const override: EntitlementOverrideRecord = {
      actorId: context?.actorId ?? null,
      effectiveAt: new Date("2026-07-20T00:00:00.000Z"),
      ...input,
    };
    const state = this.states[tenantId];
    assert.ok(state);
    state.overrides = [
      ...state.overrides.filter((item) => item.moduleKey !== input.moduleKey),
      override,
    ];
    return override;
  }
}

function activeSubscription(planCode: PlanCode) {
  return {
    endsAt: "2099-12-31T23:59:59.000Z",
    planCode,
    startsAt: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE" as const,
  };
}

test("activates core and plan modules for a usable subscription", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  const snapshot = await service.replaceSubscription(
    TENANT_ID,
    activeSubscription(PLAN_CODES.profile),
    { actorId: ACTOR_ID },
  );

  assert.equal(snapshot.subscription?.planCode, PLAN_CODES.profile);
  assert.equal(snapshot.modules.find((item) => item.key === MODULES.coreTenancy)?.source, "CORE");
  assert.equal(snapshot.modules.find((item) => item.key === MODULES.cafeProfile)?.source, "PLAN");
  await service.requireAccess(TENANT_ID, MODULES.cafeProfile);
  await assert.rejects(
    () => service.requireAccess(TENANT_ID, MODULES.inventoryBasic),
    ForbiddenException,
  );
});

test("resolves dependencies for custom entitlement and blocks an invalid disable", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  await service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.customModular));
  const snapshot = await service.setEntitlement(
    TENANT_ID,
    { enabled: true, moduleKey: MODULES.tableSelfOrder, reason: "Pilot self-order" },
    { actorId: ACTOR_ID },
  );

  const profile = snapshot.modules.find((item) => item.key === MODULES.cafeProfile);
  assert.equal(profile?.enabled, true);
  assert.equal(profile?.source, "DEPENDENCY");
  assert.deepEqual(profile?.requiredBy, [MODULES.tableSelfOrder]);

  await assert.rejects(
    () =>
      service.setEntitlement(TENANT_ID, {
        enabled: false,
        moduleKey: MODULES.cafeProfile,
        reason: "Disable profile",
      }),
    ConflictException,
  );
});

test("denies every tenant route while subscription is suspended", async () => {
  const repository = new MemoryEntitlementRepository();
  const service = new EntitlementService(repository);
  await service.replaceSubscription(TENANT_ID, {
    ...activeSubscription(PLAN_CODES.profile),
    status: "SUSPENDED",
  });

  await assert.rejects(() => service.requireAccess(TENANT_ID), ForbiddenException);
  const snapshot = await service.getSnapshot(TENANT_ID);
  assert.equal(
    snapshot.modules.every((item) => !item.enabled),
    true,
  );
});

test("a subscription records the published package version and its first cycle", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  const snapshot = await service.replaceSubscription(TENANT_ID, {
    ...activeSubscription(PLAN_CODES.profile),
    endsAt: "2026-08-20T00:00:00.000Z",
  });

  assert.equal(snapshot.subscription?.packageVersion, 2);
  assert.equal(snapshot.subscription?.cycleStartsAt, snapshot.subscription?.startsAt);
  assert.equal(snapshot.subscription?.cycleEndsAt, "2026-08-20T00:00:00.000Z");
});

test("a package without a published version cannot be subscribed to", async () => {
  const repository = new MemoryEntitlementRepository();
  repository.findPlanByCode = async (code) => {
    const plan = plans.find((item) => item.code === code);
    return plan ? { ...plan, publishedVersion: null } : null;
  };
  const service = new EntitlementService(repository);

  await assert.rejects(
    () => service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.profile)),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal((error.getResponse() as { code: string }).code, "PACKAGE_VERSION_NOT_PUBLISHED");
      return true;
    },
  );
  assert.equal(repository.state.subscription, null);
});

test("a draft subscription gives no access", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  await service.replaceSubscription(TENANT_ID, {
    ...activeSubscription(PLAN_CODES.profile),
    status: "DRAFT",
  });

  await assert.rejects(() => service.requireAccess(TENANT_ID), ForbiddenException);
});

test("a subscription canceled at period end works until the period ends", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  const canceled = {
    ...activeSubscription(PLAN_CODES.profile),
    status: "CANCELED_AT_PERIOD_END" as const,
  };

  await assert.rejects(
    () => service.replaceSubscription(TENANT_ID, { ...canceled, endsAt: null }),
    BadRequestException,
  );

  await service.replaceSubscription(TENANT_ID, { ...canceled, endsAt: "2026-08-20T00:00:00.000Z" });
  const before = await service.getSnapshot(TENANT_ID, new Date("2026-08-19T23:59:59.000Z"));
  const after = await service.getSnapshot(TENANT_ID, new Date("2026-08-20T00:00:00.000Z"));
  assert.equal(before.modules.find((item) => item.key === MODULES.cafeProfile)?.enabled, true);
  assert.equal(
    after.modules.every((item) => !item.enabled),
    true,
  );
});

test("subscription dates that contradict each other are refused", async () => {
  const service = new EntitlementService(new MemoryEntitlementRepository());
  const base = activeSubscription(PLAN_CODES.profile);

  // Ends before it starts.
  await assert.rejects(
    () => service.replaceSubscription(TENANT_ID, { ...base, endsAt: "2026-07-19T00:00:00.000Z" }),
    BadRequestException,
  );
  // Grace period without an end and a grace deadline.
  await assert.rejects(
    () => service.replaceSubscription(TENANT_ID, { ...base, endsAt: null, status: "GRACE" }),
    BadRequestException,
  );
  // Grace deadline before the end.
  await assert.rejects(
    () =>
      service.replaceSubscription(TENANT_ID, {
        ...base,
        endsAt: "2026-08-20T00:00:00.000Z",
        graceEndsAt: "2026-08-19T00:00:00.000Z",
      }),
    BadRequestException,
  );
});

test("an override applies only inside its period", async () => {
  const repository = new MemoryEntitlementRepository();
  const service = new EntitlementService(repository);
  await service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.customModular));
  repository.state.overrides = [
    {
      actorId: null,
      effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
      enabled: true,
      endsAt: new Date("2026-09-01T00:00:00.000Z"),
      moduleKey: MODULES.cafeProfile,
      reason: "Trial of the profile module",
    },
  ];
  const profileAt = async (iso: string) =>
    (await service.getSnapshot(TENANT_ID, new Date(iso))).modules.find(
      (item) => item.key === MODULES.cafeProfile,
    );

  assert.equal((await profileAt("2026-07-31T23:59:59.000Z"))?.enabled, false);
  const during = await profileAt("2026-08-15T00:00:00.000Z");
  assert.equal(during?.enabled, true);
  assert.equal(during?.source, "OVERRIDE");
  assert.equal(during?.override?.endsAt, "2026-09-01T00:00:00.000Z");
  assert.equal((await profileAt("2026-09-01T00:00:00.000Z"))?.enabled, false);
});

test("the newest override in force wins over an older one", async () => {
  const repository = new MemoryEntitlementRepository();
  const service = new EntitlementService(repository);
  await service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.customModular));
  const base = { actorId: null, endsAt: null, moduleKey: MODULES.cafeProfile };
  repository.state.overrides = [
    {
      ...base,
      effectiveAt: new Date("2026-08-10T00:00:00.000Z"),
      enabled: false,
      reason: "Unpaid",
    },
    { ...base, effectiveAt: new Date("2026-08-01T00:00:00.000Z"), enabled: true, reason: "Promo" },
  ];

  const profile = (
    await service.getSnapshot(TENANT_ID, new Date("2026-08-15T00:00:00.000Z"))
  ).modules.find((item) => item.key === MODULES.cafeProfile);
  assert.equal(profile?.enabled, false);
  assert.equal(profile?.override?.reason, "Unpaid");
});

test("an override that would already be over is refused", async () => {
  const repository = new MemoryEntitlementRepository();
  const service = new EntitlementService(repository);
  await service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.customModular));

  await assert.rejects(
    () =>
      service.setEntitlement(TENANT_ID, {
        enabled: true,
        endsAt: "2020-01-01T00:00:00.000Z",
        moduleKey: MODULES.cafeProfile,
        reason: "Too late",
      }),
    BadRequestException,
  );
  assert.deepEqual(repository.state.overrides, []);
});

test("keeps subscription plans and entitlement overrides isolated per tenant", async () => {
  const repository = new MemoryEntitlementRepository();
  const service = new EntitlementService(repository);
  await service.replaceSubscription(TENANT_ID, activeSubscription(PLAN_CODES.profile));
  await service.replaceSubscription(TENANT_B_ID, activeSubscription(PLAN_CODES.customModular));
  await service.setEntitlement(TENANT_B_ID, {
    enabled: true,
    moduleKey: MODULES.inventoryBasic,
    reason: "Tenant B inventory pilot",
  });

  const snapshotA = await service.getSnapshot(TENANT_ID);
  const snapshotB = await service.getSnapshot(TENANT_B_ID);

  assert.equal(snapshotA.subscription?.planCode, PLAN_CODES.profile);
  assert.equal(snapshotB.subscription?.planCode, PLAN_CODES.customModular);
  assert.equal(
    snapshotA.modules.find((module) => module.key === MODULES.inventoryBasic)?.enabled,
    false,
  );
  assert.equal(
    snapshotB.modules.find((module) => module.key === MODULES.inventoryBasic)?.source,
    "OVERRIDE",
  );
});
