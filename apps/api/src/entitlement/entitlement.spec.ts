import assert from "node:assert/strict";
import test from "node:test";

import { MODULES, PLAN_CODES, type ModuleKey, type PlanCode } from "@merchant/contracts";
import { ConflictException, ForbiddenException } from "@nestjs/common";

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
    status: "ACTIVE",
  },
  {
    code: PLAN_CODES.customModular,
    id: "019f7900-0000-7000-8000-000000000202",
    moduleKeys: [],
    name: "Custom Modular",
    status: "ACTIVE",
  },
];

class MemoryEntitlementRepository implements EntitlementRepository {
  readonly state: EntitlementStateRecord = {
    modules: moduleDefinitions,
    overrides: [],
    subscription: null,
    tenant: { id: TENANT_ID, status: "ACTIVE" },
  };

  async findPlanByCode(code: PlanCode) {
    return plans.find((plan) => plan.code === code) ?? null;
  }

  async getState(tenantId: string) {
    return tenantId === TENANT_ID
      ? this.state
      : { modules: moduleDefinitions, overrides: [], subscription: null, tenant: null };
  }

  async replaceSubscription(tenantId: string, input: ReplaceSubscriptionRecordInput) {
    const plan = plans.find((item) => item.id === input.planId);
    assert.ok(plan);
    const now = new Date("2026-07-20T00:00:00.000Z");
    const subscription: SubscriptionRecord = {
      createdAt: now,
      endsAt: input.endsAt,
      graceEndsAt: input.graceEndsAt,
      id: "019f7900-0000-7000-8000-000000000301",
      planCode: plan.code,
      planId: plan.id,
      planModuleKeys: plan.moduleKeys,
      planName: plan.name,
      startsAt: input.startsAt,
      status: input.status,
      tenantId,
      updatedAt: now,
    };
    this.state.subscription = subscription;
    return subscription;
  }

  async upsertEntitlement(
    _tenantId: string,
    input: { enabled: boolean; moduleKey: ModuleKey; reason: string },
    context?: EntitlementMutationContext,
  ) {
    const override: EntitlementOverrideRecord = {
      actorId: context?.actorId ?? null,
      effectiveAt: new Date("2026-07-20T00:00:00.000Z"),
      ...input,
    };
    this.state.overrides = [
      ...this.state.overrides.filter((item) => item.moduleKey !== input.moduleKey),
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
