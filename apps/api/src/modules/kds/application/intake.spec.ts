import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { IntakeKitchenTicket as IntakeRequest } from "@merchant/contracts";
import type { HttpException } from "@nestjs/common";
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { EntitlementService } from "../../../core/entitlements/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import type { LimitGate } from "../../../shared/limits/limit-gate.js";
import {
  createIntakeKey,
  hashIntakeSecret,
  readIntakeKey,
  secretMatches,
} from "../domain/intake-key.js";
import type { CreateKitchenTicket } from "./create-kitchen-ticket.js";
import {
  INTAKE_CAPABILITY,
  INTAKE_PRO_CAPABILITY,
  INTAKE_RATE_LIMITS,
  IntakeKitchenTicket,
} from "./intake-kitchen-ticket.js";
import type {
  IntakeSourceRecord,
  IntakeSourceRepository,
  NewIntakeSource,
} from "./intake-source.repository.js";
import { INTAKE_SOURCES_DIMENSION, IntakeSources } from "./intake-sources.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f975200";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f975201";
const ACTOR = { actorId: "019f738d-e61f-7d46-92de-17b35f975202" };

class MemorySources implements IntakeSourceRepository {
  readonly stored: IntakeSourceRecord[] = [];
  readonly audits: string[] = [];
  outletStatus: string | null = "ACTIVE";

  async countActive(tenantId: string) {
    return this.stored.filter((item) => item.tenantId === tenantId && item.status === "ACTIVE")
      .length;
  }
  async create(tenantId: string, source: NewIntakeSource) {
    const record: IntakeSourceRecord = {
      ...source,
      createdAt: new Date(),
      id: randomUUID(),
      lastUsedAt: null,
      revokedAt: null,
      status: "ACTIVE",
      tenantId,
    };
    this.stored.push(record);
    this.audits.push("kds.intake_source.create");
    return record;
  }
  async findActiveByPrefix(keyPrefix: string) {
    return (
      this.stored.find((item) => item.keyPrefix === keyPrefix && item.status === "ACTIVE") ?? null
    );
  }
  async findOutlet() {
    return this.outletStatus ? { status: this.outletStatus } : null;
  }
  async list(tenantId: string) {
    return this.stored.filter((item) => item.tenantId === tenantId);
  }
  async revoke(tenantId: string, id: string, now: Date) {
    const source = this.stored.find(
      (item) => item.tenantId === tenantId && item.id === id && item.status === "ACTIVE",
    );
    if (!source) return null;
    source.status = "REVOKED";
    source.revokedAt = now;
    this.audits.push("kds.intake_source.revoke");
    return source;
  }
  async touch(id: string, now: Date) {
    const source = this.stored.find((item) => item.id === id);
    if (source) source.lastUsedAt = now;
  }
}

function setup(
  options: { capabilities?: string[]; limit?: number; subscriptionUsable?: boolean } = {},
) {
  const sources = new MemorySources();
  const limits: LimitGate = {
    assertCanAdd: async (tenantId, dimensionKey) => {
      assert.equal(dimensionKey, INTAKE_SOURCES_DIMENSION);
      if ((await sources.countActive(tenantId)) >= (options.limit ?? 1)) {
        throw new ConflictException({ code: "LIMIT_REACHED" });
      }
    },
  };
  const made: Array<{ input: Record<string, unknown>; origin?: CommandOrigin; outletId: string }> =
    [];
  const createTicket = {
    execute: async (
      _tenantId: string,
      outletId: string,
      input: Record<string, unknown>,
      origin?: CommandOrigin,
    ) => {
      const repeat = made.find((item) => item.input.sourceReference === input.sourceReference);
      made.push({ input, ...(origin ? { origin } : {}), outletId });
      return {
        created: !repeat,
        ticket: {
          acceptedAt: null,
          canceledAt: null,
          id: "019f738d-e61f-7d46-92de-17b35f975299",
          items: [{ allergyNote: null, modifiers: [], name: "Latte", note: null, quantity: 1 }],
          orderLabel: String(input.orderLabel),
          readyAt: null,
          receivedAt: new Date().toISOString(),
          servedAt: null,
          source: "API",
          startedAt: null,
          status: "NEW",
          tableLabel: null,
        },
      };
    },
  } as unknown as CreateKitchenTicket;
  const entitlements = {
    describeAccess: async () => ({
      capabilities: new Set(options.capabilities ?? [INTAKE_CAPABILITY]),
      installation: "ACTIVE",
      module: { entitled: true, tier: "BASIC" },
      subscriptionUsable: options.subscriptionUsable ?? true,
    }),
  } as unknown as EntitlementService;
  return {
    intake: new IntakeKitchenTicket(sources, createTicket, entitlements),
    made,
    manage: new IntakeSources(sources, limits),
    sources,
  };
}

const request: IntakeRequest = {
  items: [{ modifiers: [], name: "Latte", quantity: 1 }],
  orderLabel: "GrabFood 4821",
  reference: "order-4821",
};

test("an intake key is a prefix and a secret; only the secret's hash is kept", () => {
  const { key, prefix, secretHash } = createIntakeKey();
  assert.match(key, /^kds_[a-z2-9]{10}_[A-Za-z0-9_-]{43}$/);
  const read = readIntakeKey(`Bearer ${key}`);
  assert.equal(read?.prefix, prefix);
  assert.equal(hashIntakeSecret(read?.secret ?? ""), secretHash);
  assert.equal(secretMatches(read?.secret ?? "", secretHash), true);
  assert.equal(secretMatches("x".repeat(43), secretHash), false);
  assert.ok(!key.includes(secretHash));
  for (const header of [
    undefined,
    "",
    key,
    `Basic ${key}`,
    "Bearer kds_short_x",
    `Bearer ${key}x`,
  ]) {
    assert.equal(readIntakeKey(header), undefined, String(header));
  }
});

test("a source is made with a key shown once, counts against the package, and can be revoked", async () => {
  const { manage, sources } = setup({ limit: 1 });
  const created = await manage.create(TENANT, { label: "GrabFood", outletId: OUTLET }, ACTOR);
  assert.match(created.key, /^kds_/);
  assert.equal(created.source.keyPrefix, created.key.slice(4, 14));
  assert.deepEqual(Object.keys(created.source).sort(), [
    "createdAt",
    "id",
    "keyPrefix",
    "label",
    "lastUsedAt",
    "outletId",
    "revokedAt",
    "status",
  ]);
  // The list never shows the key again.
  assert.ok(!JSON.stringify(await manage.list(TENANT)).includes(created.key.slice(15)));

  // KDS Basic: one source.
  await assert.rejects(
    manage.create(TENANT, { label: "Website", outletId: OUTLET }, ACTOR),
    (error: HttpException) => (error.getResponse() as { code: string }).code === "LIMIT_REACHED",
  );
  const revoked = await manage.revoke(TENANT, created.source.id, ACTOR);
  assert.equal(revoked.status, "REVOKED");
  await assert.rejects(manage.revoke(TENANT, created.source.id, ACTOR), NotFoundException);
  // A revoked source frees its place.
  await manage.create(TENANT, { label: "Website", outletId: OUTLET }, ACTOR);
  assert.deepEqual(sources.audits, [
    "kds.intake_source.create",
    "kds.intake_source.revoke",
    "kds.intake_source.create",
  ]);

  // Only for an open outlet.
  sources.outletStatus = "INACTIVE";
  await assert.rejects(
    manage.create(TENANT, { label: "Closed", outletId: OUTLET }, ACTOR),
    (error: HttpException) => (error.getResponse() as { code: string }).code === "OUTLET_INACTIVE",
  );
});

test("intake goes through the one use case, as source API, in the key's workspace and outlet", async () => {
  const { intake, made, manage, sources } = setup();
  const { key, source } = await manage.create(
    TENANT,
    { label: "GrabFood", outletId: OUTLET },
    ACTOR,
  );
  const caller = await intake.authenticate(`Bearer ${key}`);
  assert.equal(caller.id, source.id);

  const first = await intake.execute(caller, request, { requestId: "req_1" });
  const again = await intake.execute(caller, request);
  assert.equal(first.created, true);
  assert.equal(again.created, false);
  assert.equal(made[0]?.outletId, OUTLET);
  assert.deepEqual(made[0]?.input, {
    items: request.items,
    orderLabel: "GrabFood 4821",
    source: "API",
    sourceReference: `${source.keyPrefix}:order-4821`,
  });
  assert.deepEqual(made[0]?.origin, { channel: "API", requestId: "req_1" });
  assert.notEqual(sources.stored[0]?.lastUsedAt, null);
});

test("a wrong, unknown, or revoked key gets one answer", async () => {
  const { intake, manage } = setup();
  const { key, source } = await manage.create(
    TENANT,
    { label: "GrabFood", outletId: OUTLET },
    ACTOR,
  );
  const refused = (error: HttpException) =>
    error.getStatus() === 401 &&
    (error.getResponse() as { code: string }).code === "KDS_INTAKE_KEY_INVALID";
  const wrongSecret = `${key.slice(0, 15)}${"A".repeat(43)}`;
  const unknownPrefix = `kds_zzzzzzzzzz_${key.slice(15)}`;
  for (const header of [
    undefined,
    "Bearer nonsense",
    `Bearer ${wrongSecret}`,
    `Bearer ${unknownPrefix}`,
  ]) {
    await assert.rejects(intake.authenticate(header), refused);
  }
  await manage.revoke(TENANT, source.id, ACTOR);
  await assert.rejects(intake.authenticate(`Bearer ${key}`), refused);
});

test("intake stops when the workspace no longer has the kitchen or the outlet is closed", async () => {
  const withoutCapability = setup({ capabilities: [] });
  const one = await withoutCapability.manage.create(
    TENANT,
    { label: "A1", outletId: OUTLET },
    ACTOR,
  );
  await assert.rejects(
    withoutCapability.intake.execute(
      await withoutCapability.intake.authenticate(`Bearer ${one.key}`),
      request,
    ),
    (error: HttpException) =>
      (error.getResponse() as { code: string }).code === "ENTITLEMENT_REQUIRED",
  );
  assert.equal(withoutCapability.made.length, 0);

  const suspended = setup({ subscriptionUsable: false });
  const two = await suspended.manage.create(TENANT, { label: "A2", outletId: OUTLET }, ACTOR);
  await assert.rejects(
    suspended.intake.execute(await suspended.intake.authenticate(`Bearer ${two.key}`), request),
    (error: HttpException) =>
      (error.getResponse() as { code: string }).code === "SUBSCRIPTION_SUSPENDED",
  );

  const closed = setup();
  const three = await closed.manage.create(TENANT, { label: "A3", outletId: OUTLET }, ACTOR);
  closed.sources.outletStatus = "INACTIVE";
  await assert.rejects(
    closed.intake.execute(await closed.intake.authenticate(`Bearer ${three.key}`), request),
  );
  assert.equal(closed.made.length, 0);
});

test("a source may send 60 requests a minute on Basic and 600 with the Pro intake", async () => {
  const tooMany = (error: HttpException) =>
    error.getStatus() === 429 &&
    (error.getResponse() as { code: string }).code === "RATE_LIMIT_EXCEEDED";
  for (const [capabilities, allowed] of [
    [[INTAKE_CAPABILITY], INTAKE_RATE_LIMITS.basic.limit],
    [[INTAKE_CAPABILITY, INTAKE_PRO_CAPABILITY], INTAKE_RATE_LIMITS.pro.limit],
  ] as const) {
    const { intake, made, manage } = setup({ capabilities: [...capabilities] });
    const { key } = await manage.create(TENANT, { label: "GrabFood", outletId: OUTLET }, ACTOR);
    const caller = await intake.authenticate(`Bearer ${key}`);
    for (let index = 0; index < allowed; index += 1) {
      await intake.execute(caller, { ...request, reference: `order-${index}` });
    }
    await assert.rejects(intake.execute(caller, { ...request, reference: "one-more" }), tooMany);
    assert.equal(made.length, allowed);
  }
  assert.deepEqual([INTAKE_RATE_LIMITS.basic.limit, INTAKE_RATE_LIMITS.pro.limit], [60, 600]);
});

test("each source has its own minute, and wrong keys are limited per network address", async () => {
  const { intake, manage } = setup({ limit: 2 });
  const one = await manage.create(TENANT, { label: "Satu", outletId: OUTLET }, ACTOR);
  const two = await manage.create(TENANT, { label: "Dua", outletId: OUTLET }, ACTOR);
  const first = await intake.authenticate(`Bearer ${one.key}`);
  for (let index = 0; index < INTAKE_RATE_LIMITS.basic.limit; index += 1) {
    await intake.execute(first, { ...request, reference: `a-${index}` });
  }
  // The other source is not held back by the first.
  await intake.execute(await intake.authenticate(`Bearer ${two.key}`), request);

  const status = async (promise: Promise<unknown>) =>
    promise.then(
      () => 200,
      (error: HttpException) => error.getStatus(),
    );
  for (let index = 0; index < INTAKE_RATE_LIMITS.invalidKey.limit; index += 1) {
    assert.equal(await status(intake.authenticate("Bearer wrong", "203.0.113.7")), 401);
  }
  assert.equal(await status(intake.authenticate("Bearer wrong", "203.0.113.7")), 429);
  // Another address, and a right key from the same one, still get through to the check.
  assert.equal(await status(intake.authenticate("Bearer wrong", "198.51.100.2")), 401);
  assert.equal(await status(intake.authenticate(`Bearer ${two.key}`, "203.0.113.7")), 200);
});
