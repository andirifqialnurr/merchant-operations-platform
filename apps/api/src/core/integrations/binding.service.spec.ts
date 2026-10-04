import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULES,
  type IntegrationBindingHealth,
  type IntegrationBindingStatus,
  type ModuleKey,
  type ModuleManifest,
} from "@merchant/contracts";
import { ConflictException, NotFoundException } from "@nestjs/common";

import { MODULE_MANIFESTS } from "../../module-manifests.js";
import {
  BlockedEventError,
  EventHandlerRegistry,
  type EventEnvelope,
  type EventHandler,
} from "../events/event-handler.js";
import {
  OutboxDispatcher,
  type ClaimedEvent,
  type InboxStatus,
  type InboxStore,
  type OutboxStore,
} from "../events/outbox-dispatcher.js";
import { ModuleManifestRegistry } from "../manifest/module-manifest.registry.js";
import type { BindingKey, BindingRecord, BindingRepository } from "./binding.repository.js";
import { BindingService } from "./binding.service.js";

const WORKSPACE = "019f738d-e61f-7d46-92de-17b35f976001";
const INSTALLED_AT = new Date("2026-10-10T00:00:00.000Z");
const HANDLER = "kds.create_ticket";

/** A kitchen module that reacts to submitted orders, as M3 will add it. */
const kdsManifest: ModuleManifest = {
  capabilities: [],
  capabilityTiers: {},
  configSchemaVersion: 1,
  displayName: "Kitchen Display System",
  eventHandlers: [{ eventType: "order.submitted.v1", handlerKey: HANDLER }],
  eventsProduced: [],
  installSteps: [],
  internalDependencies: [MODULES.coreOrder],
  key: MODULES.kds,
  limitDimensions: [],
  namespaces: ["kds"],
  navigation: [],
  permissions: [],
  routes: [],
  settings: [],
  supportedWorkspaceTypes: ["BUSINESS"],
  version: "1.0.0",
};

class MemoryBindingRepository implements BindingRepository {
  readonly rows: BindingRecord[] = [];
  readonly audit: string[] = [];

  private match(tenantId: string, key: BindingKey) {
    return this.rows.find(
      (row) =>
        row.tenantId === tenantId &&
        row.sourceModuleKey === key.sourceModuleKey &&
        row.eventType === key.eventType &&
        row.targetModuleKey === key.targetModuleKey &&
        row.handlerKey === key.handlerKey,
    );
  }

  async createIfMissing(tenantId: string, key: BindingKey, effectiveFrom: Date) {
    if (this.match(tenantId, key)) return false;
    this.rows.push({
      ...key,
      auditReason: null,
      configSchemaVersion: 1,
      effectiveFrom,
      effectiveTo: null,
      health: "HEALTHY",
      id: `019f738d-e61f-7d46-92de-17b35f97610${this.rows.length}`,
      lastError: null,
      status: "ACTIVE",
      tenantId,
      updatedAt: effectiveFrom,
    });
    return true;
  }

  async find(tenantId: string, key: BindingKey) {
    return this.match(tenantId, key) ?? null;
  }

  async findById(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) ?? null;
  }

  async list(tenantId: string) {
    return this.rows.filter((row) => row.tenantId === tenantId);
  }

  async listForTarget(tenantId: string, targetModuleKey: ModuleKey) {
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.targetModuleKey === targetModuleKey,
    );
  }

  async setHealth(id: string, health: IntegrationBindingHealth, lastError: string | null) {
    const row = this.rows.find((item) => item.id === id);
    if (row) Object.assign(row, { health, lastError });
  }

  async setStatus(
    tenantId: string,
    id: string,
    expected: IntegrationBindingStatus,
    change: Parameters<BindingRepository["setStatus"]>[3],
    options: { action: string },
  ) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    if (!row || row.status !== expected) return null;
    Object.assign(row, change);
    this.audit.push(options.action);
    return row;
  }
}

function event(occurredAt: Date, eventId = "event-1"): EventEnvelope {
  return {
    actor: null,
    causationId: null,
    channel: null,
    clientVersion: null,
    deviceId: null,
    correlationId: null,
    eventId,
    eventType: "order.submitted.v1",
    eventVersion: 1,
    locationId: null,
    occurredAt,
    payload: {},
    producer: "CORE_ORDER",
    recordedAt: occurredAt,
    workspaceId: WORKSPACE,
  };
}

const kdsHandler = (handle: EventHandler["handle"] = async () => undefined): EventHandler => ({
  consumerName: HANDLER,
  eventType: "order.submitted.v1",
  handle,
  moduleKey: MODULES.kds,
});

function setup(manifests: readonly ModuleManifest[] = [...MODULE_MANIFESTS, kdsManifest]) {
  const repository = new MemoryBindingRepository();
  const service = new BindingService(repository, new ModuleManifestRegistry(manifests));
  return { repository, service };
}

const after = new Date(INSTALLED_AT.getTime() + 60_000);
const before = new Date(INSTALLED_AT.getTime() - 60_000);

test("installing a module gives it one active binding per event it reacts to", async () => {
  const { repository, service } = setup();
  const bindings = await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);

  assert.equal(bindings.length, 1);
  assert.deepEqual(
    {
      eventType: bindings[0]?.eventType,
      handlerKey: bindings[0]?.handlerKey,
      sourceModuleKey: bindings[0]?.sourceModuleKey,
      status: bindings[0]?.status,
      targetModuleKey: bindings[0]?.targetModuleKey,
    },
    {
      eventType: "order.submitted.v1",
      handlerKey: HANDLER,
      sourceModuleKey: MODULES.coreOrder,
      status: "ACTIVE",
      targetModuleKey: MODULES.kds,
    },
  );

  // Doing it again creates nothing new.
  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, after);
  assert.equal(repository.rows.length, 1);
  assert.equal(repository.rows[0]?.effectiveFrom.getTime(), INSTALLED_AT.getTime());
});

test("a reaction inside one module needs no binding", async () => {
  const { repository, service } = setup();
  // The subscription core reacts to its own event.
  await service.ensureForModule(WORKSPACE, MODULES.coreSubscription, undefined, INSTALLED_AT);
  assert.equal(repository.rows.length, 0);

  const own: EventHandler = {
    consumerName: "core.entitlement_projection",
    eventType: "module.installed.v1",
    handle: async () => undefined,
    moduleKey: MODULES.coreSubscription,
  };
  assert.deepEqual(await service.decide(own, event(after)), { action: "run" });
});

test("only an active binding lets the handler run, and only for events after it started", async () => {
  const { repository, service } = setup();
  // No binding at all: the module does not react.
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), { action: "skip" });

  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), { action: "run" });
  // What happened before the module was added is not replayed.
  assert.deepEqual(await service.decide(kdsHandler(), event(before)), { action: "skip" });

  const id = repository.rows[0]!.id;
  await service.pause(WORKSPACE, id, "Kitchen screen is being replaced");
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), {
    action: "block",
    reason: "The integration is paused.",
  });
  assert.equal(repository.rows[0]?.auditReason, "Kitchen screen is being replaced");

  await service.resume(WORKSPACE, id);
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), { action: "run" });
});

test("removing the module switches its bindings off, and installing again starts fresh", async () => {
  const { repository, service } = setup();
  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);

  await service.disableForModule(WORKSPACE, MODULES.kds);
  assert.equal(repository.rows[0]?.status, "DISABLED");
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), { action: "skip" });

  const reinstalledAt = new Date(after.getTime() + 60_000);
  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, reinstalledAt);
  assert.equal(repository.rows.length, 1);
  assert.equal(repository.rows[0]?.status, "ACTIVE");
  // Events from the gap while the module was removed stay undelivered.
  assert.deepEqual(await service.decide(kdsHandler(), event(after)), { action: "skip" });
  assert.deepEqual(
    await service.decide(kdsHandler(), event(new Date(reinstalledAt.getTime() + 1))),
    { action: "run" },
  );
  assert.deepEqual(repository.audit, ["integration_binding.disable", "integration_binding.enable"]);
});

test("pausing and resuming follow the binding's status and refuse anything else", async () => {
  const { repository, service } = setup();
  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);
  const id = repository.rows[0]!.id;
  const codeOf = async (action: () => Promise<unknown>) => {
    try {
      await action();
      return "OK";
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        return (error.getResponse() as { code: string }).code;
      }
      throw error;
    }
  };

  // Not paused, so there is nothing to resume.
  assert.equal(
    await codeOf(() => service.resume(WORKSPACE, id)),
    "INTEGRATION_BINDING_INVALID_TRANSITION",
  );
  assert.equal((await service.pause(WORKSPACE, id, "Maintenance")).status, "PAUSED");
  assert.equal(
    await codeOf(() => service.pause(WORKSPACE, id, "Again")),
    "INTEGRATION_BINDING_INVALID_TRANSITION",
  );
  assert.equal((await service.resume(WORKSPACE, id)).status, "ACTIVE");
  // Another workspace cannot reach this binding.
  assert.equal(
    await codeOf(() => service.pause("019f738d-e61f-7d46-92de-17b35f976999", id, "Not mine")),
    "INTEGRATION_BINDING_NOT_FOUND",
  );
});

test("the binding shows how its last delivery went", async () => {
  const { repository, service } = setup();
  await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);

  await service.report(kdsHandler(), event(after), {
    blockedReason: "No station is set up for this location.",
    ok: false,
  });
  assert.equal(repository.rows[0]?.health, "BLOCKED");
  assert.equal(repository.rows[0]?.lastError, "No station is set up for this location.");

  await service.report(kdsHandler(), event(after), { ok: true });
  assert.equal(repository.rows[0]?.health, "HEALTHY");
  assert.equal(repository.rows[0]?.lastError, null);
});

// ---- Module combinations (M2-QA-06): the cashier keeps working whatever is on the other side.

class OneEventOutbox implements OutboxStore {
  processed = false;
  rescheduled = 0;
  private claimed = false;

  constructor(private readonly envelope: EventEnvelope) {}

  async claim(): Promise<ClaimedEvent[]> {
    if (this.claimed) return [];
    this.claimed = true;
    return [{ attempt: 1, envelope: this.envelope }];
  }

  async markFailed() {}

  async markProcessed() {
    this.processed = true;
  }

  async reschedule() {
    this.rescheduled += 1;
  }
}

class MemoryInbox implements InboxStore {
  readonly entries = new Map<string, { error?: string; status: InboxStatus }>();

  async find(_workspace: string, consumerName: string) {
    return this.entries.get(consumerName)?.status ?? null;
  }

  async record(entry: Parameters<InboxStore["record"]>[0]) {
    this.entries.set(entry.consumerName, {
      ...(entry.error ? { error: entry.error } : {}),
      status: entry.status,
    });
  }
}

async function deliver({
  handler,
  moduleActive = true,
  prepare,
  withKds = true,
}: {
  handler?: EventHandler;
  moduleActive?: boolean;
  prepare?: (service: BindingService, repository: MemoryBindingRepository) => Promise<void>;
  withKds?: boolean;
}) {
  const { repository, service } = setup(
    withKds ? [...MODULE_MANIFESTS, kdsManifest] : MODULE_MANIFESTS,
  );
  await prepare?.(service, repository);
  const registry = new EventHandlerRegistry();
  if (handler) registry.register(handler);
  const outbox = new OneEventOutbox(event(after));
  const inbox = new MemoryInbox();
  const dispatcher = new OutboxDispatcher(
    outbox,
    inbox,
    registry,
    async () => moduleActive,
    undefined,
    () => after,
    service,
  );
  await dispatcher.dispatchBatch();
  return { inbox, outbox, repository };
}

test("POS only: an order event with no other module is simply done", async () => {
  const { inbox, outbox } = await deliver({ withKds: false });
  assert.equal(outbox.processed, true);
  assert.equal(inbox.entries.size, 0);
});

test("POS with the kitchen binding switched off: the event is done and the kitchen is not called", async () => {
  let calls = 0;
  const { inbox, outbox } = await deliver({
    handler: kdsHandler(async () => void (calls += 1)),
    prepare: async (service) => {
      await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);
      await service.disableForModule(WORKSPACE, MODULES.kds);
    },
  });
  assert.equal(calls, 0);
  assert.equal(outbox.processed, true);
  // Nothing was held back for later either.
  assert.equal(inbox.entries.size, 0);
});

test("POS with an active binding and a working kitchen: the kitchen gets the order once", async () => {
  let calls = 0;
  const { inbox, outbox, repository } = await deliver({
    handler: kdsHandler(async () => void (calls += 1)),
    prepare: (service) =>
      service
        .ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT)
        .then(() => undefined),
  });
  assert.equal(calls, 1);
  assert.equal(outbox.processed, true);
  assert.equal(inbox.entries.get(HANDLER)?.status, "PROCESSED");
  assert.equal(repository.rows[0]?.health, "HEALTHY");
});

test("POS with an active binding but no receiver in code: the event is still done", async () => {
  const { inbox, outbox } = await deliver({
    prepare: (service) =>
      service
        .ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT)
        .then(() => undefined),
  });
  assert.equal(outbox.processed, true);
  assert.equal(inbox.entries.size, 0);
});

test("POS with an active binding whose module is not active: the event waits instead of being lost", async () => {
  let calls = 0;
  const { inbox, outbox } = await deliver({
    handler: kdsHandler(async () => void (calls += 1)),
    moduleActive: false,
    prepare: (service) =>
      service
        .ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT)
        .then(() => undefined),
  });
  assert.equal(calls, 0);
  assert.equal(outbox.processed, false);
  assert.equal(outbox.rescheduled, 1);
  assert.equal(inbox.entries.get(HANDLER)?.status, "RETRYING");
});

test("POS with a paused binding: the sale is unaffected and the event is held with a reason", async () => {
  let calls = 0;
  const { inbox, outbox } = await deliver({
    handler: kdsHandler(async () => void (calls += 1)),
    prepare: async (service, repository) => {
      await service.ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT);
      await service.pause(WORKSPACE, repository.rows[0]!.id, "Kitchen is closed for repairs");
    },
  });
  assert.equal(calls, 0);
  assert.equal(outbox.processed, true);
  assert.deepEqual(inbox.entries.get(HANDLER), {
    error: "The integration is paused.",
    status: "BLOCKED",
  });
});

test("a kitchen handler blocked by a setting marks the binding as blocked", async () => {
  const { inbox, repository } = await deliver({
    handler: kdsHandler(async () => {
      throw new BlockedEventError("No station is set up for this location.");
    }),
    prepare: (service) =>
      service
        .ensureForModule(WORKSPACE, MODULES.kds, undefined, INSTALLED_AT)
        .then(() => undefined),
  });
  assert.equal(inbox.entries.get(HANDLER)?.status, "BLOCKED");
  assert.equal(repository.rows[0]?.health, "BLOCKED");
  assert.match(repository.rows[0]?.lastError ?? "", /No station is set up/);
});

test("the platform core reacts to other modules' events without a binding", async () => {
  const { repository, service } = setup();
  // Metering belongs to the subscription core and counts sales announced by the bill core.
  const metering: EventHandler = {
    consumerName: "core.usage_pos_sales",
    eventType: "sale.completed.v1",
    handle: async () => undefined,
    moduleKey: MODULES.coreSubscription,
  };
  assert.deepEqual(
    await service.decide(metering, { ...event(after), eventType: "sale.completed.v1" }),
    { action: "run" },
  );
  assert.equal(repository.rows.length, 0);
});
