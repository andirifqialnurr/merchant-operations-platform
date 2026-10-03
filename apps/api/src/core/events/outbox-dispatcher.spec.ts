import assert from "node:assert/strict";
import test from "node:test";

import { MODULES, type ModuleKey } from "@merchant/contracts";

import {
  BlockedEventError,
  EventHandlerRegistry,
  type EventEnvelope,
  type EventHandler,
} from "./event-handler.js";
import {
  OutboxDispatcher,
  type ClaimedEvent,
  type DispatcherOptions,
  type InboxStatus,
  type InboxStore,
  type OutboxStore,
} from "./outbox-dispatcher.js";

const WORKSPACE = "019f738d-e61f-7d46-92de-17b35f975001";
const START = new Date("2026-10-10T00:00:00.000Z");
const options: DispatcherOptions = {
  baseDelayMs: 1_000,
  batchSize: 10,
  leaseMs: 30_000,
  maxAttempts: 3,
  maxDelayMs: 4_000,
};

type Stored = {
  attempts: number;
  availableAt: Date;
  envelope: EventEnvelope;
  failedAt?: Date;
  lastError?: string;
  processedAt?: Date;
};

class MemoryOutbox implements OutboxStore {
  readonly events = new Map<string, Stored>();

  add(eventType: string, eventId = `event-${this.events.size + 1}`) {
    this.events.set(eventId, {
      attempts: 0,
      availableAt: START,
      envelope: {
        actor: null,
        causationId: null,
        correlationId: null,
        eventId,
        eventType,
        eventVersion: 1,
        locationId: null,
        occurredAt: START,
        payload: { orderId: "order-1" },
        producer: "CORE_ORDER",
        recordedAt: START,
        workspaceId: WORKSPACE,
      },
    });
    return this.events.get(eventId)!;
  }

  async claim(limit: number, leaseMs: number, now: Date): Promise<ClaimedEvent[]> {
    const due = [...this.events.values()]
      .filter((item) => !item.processedAt && !item.failedAt && item.availableAt <= now)
      .slice(0, limit);
    for (const item of due) {
      item.attempts += 1;
      item.availableAt = new Date(now.getTime() + leaseMs);
    }
    return due.map((item) => ({ attempt: item.attempts, envelope: item.envelope }));
  }

  async markProcessed(eventId: string, now: Date) {
    this.events.get(eventId)!.processedAt = now;
  }

  async markFailed(eventId: string, error: string, now: Date) {
    Object.assign(this.events.get(eventId)!, { failedAt: now, lastError: error });
  }

  async reschedule(eventId: string, error: string, availableAt: Date) {
    Object.assign(this.events.get(eventId)!, { availableAt, lastError: error });
  }
}

class MemoryInbox implements InboxStore {
  readonly entries = new Map<string, { error?: string; reference?: string; status: InboxStatus }>();

  async find(workspaceId: string, consumerName: string, eventId: string) {
    return this.entries.get(`${workspaceId}|${consumerName}|${eventId}`)?.status ?? null;
  }

  async record(entry: Parameters<InboxStore["record"]>[0]) {
    this.entries.set(`${entry.workspaceId}|${entry.consumerName}|${entry.eventId}`, {
      ...(entry.error ? { error: entry.error } : {}),
      ...(entry.resultReference ? { reference: entry.resultReference } : {}),
      status: entry.status,
    });
  }

  of(consumerName: string, eventId = "event-1") {
    return this.entries.get(`${WORKSPACE}|${consumerName}|${eventId}`);
  }
}

function setup(
  handlers: Array<Partial<EventHandler> & Pick<EventHandler, "consumerName" | "handle">>,
) {
  const outbox = new MemoryOutbox();
  const inbox = new MemoryInbox();
  const registry = new EventHandlerRegistry();
  for (const handler of handlers) {
    registry.register({ eventType: "order.submitted.v1", moduleKey: MODULES.kds, ...handler });
  }
  const clock = { now: START };
  const unavailable = new Set<ModuleKey>();
  const dispatcher = new OutboxDispatcher(
    outbox,
    inbox,
    registry,
    async (_workspace, moduleKey) => !unavailable.has(moduleKey),
    options,
    () => clock.now,
  );
  return {
    advance: (ms: number) => {
      clock.now = new Date(clock.now.getTime() + ms);
    },
    dispatcher,
    inbox,
    outbox,
    unavailable,
  };
}

test("an event nobody listens to is simply done", async () => {
  const { dispatcher, outbox } = setup([]);
  const event = outbox.add("sale.completed.v1");

  assert.equal(await dispatcher.dispatchBatch(), 1);
  assert.ok(event.processedAt);
  assert.equal(await dispatcher.dispatchBatch(), 0);
});

test("a handler runs once and its result is recorded in the inbox", async () => {
  const calls: string[] = [];
  const { dispatcher, inbox, outbox } = setup([
    {
      consumerName: "kds.create_ticket",
      handle: async (event) => {
        calls.push(event.eventId);
        return "ticket:42";
      },
    },
  ]);
  const event = outbox.add("order.submitted.v1");
  await dispatcher.dispatchBatch();

  assert.deepEqual(calls, ["event-1"]);
  assert.deepEqual(inbox.of("kds.create_ticket"), { reference: "ticket:42", status: "PROCESSED" });
  assert.ok(event.processedAt);
});

test("an event delivered a second time has no second effect", async () => {
  let calls = 0;
  const { advance, dispatcher, outbox } = setup([
    { consumerName: "kds.create_ticket", handle: async () => void (calls += 1) },
  ]);
  const event = outbox.add("order.submitted.v1");
  await dispatcher.dispatchBatch();

  // The worker died after the handler ran but before the outbox was updated.
  delete event.processedAt;
  advance(options.leaseMs);
  await dispatcher.dispatchBatch();

  assert.equal(calls, 1);
  assert.ok(event.processedAt);
});

test("a temporary failure is retried later with a growing delay, then succeeds", async () => {
  let failures = 2;
  const { advance, dispatcher, inbox, outbox } = setup([
    {
      consumerName: "kds.create_ticket",
      handle: async () => {
        if (failures > 0) {
          failures -= 1;
          throw new Error("database is restarting");
        }
      },
    },
  ]);
  const event = outbox.add("order.submitted.v1");

  await dispatcher.dispatchBatch();
  assert.equal(inbox.of("kds.create_ticket")?.status, "RETRYING");
  assert.equal(event.availableAt.getTime() - START.getTime(), 1_000);
  assert.equal(await dispatcher.dispatchBatch(), 0, "not due yet");

  advance(1_000);
  await dispatcher.dispatchBatch();
  assert.equal(event.availableAt.getTime() - START.getTime(), 1_000 + 2_000);

  advance(2_000);
  await dispatcher.dispatchBatch();
  assert.equal(inbox.of("kds.create_ticket")?.status, "PROCESSED");
  assert.ok(event.processedAt);
});

test("a failure that retrying cannot fix is blocked with its reason and not retried", async () => {
  let calls = 0;
  const { advance, dispatcher, inbox, outbox } = setup([
    {
      consumerName: "finance.post_sale",
      handle: async () => {
        calls += 1;
        throw new BlockedEventError("No income account is mapped for this location.");
      },
    },
  ]);
  const event = outbox.add("order.submitted.v1");
  await dispatcher.dispatchBatch();

  assert.deepEqual(inbox.of("finance.post_sale"), {
    error: "BlockedEventError: No income account is mapped for this location.",
    status: "BLOCKED",
  });
  // The event itself is finished; the blocked handler waits for a person.
  assert.ok(event.processedAt);
  advance(60_000);
  assert.equal(await dispatcher.dispatchBatch(), 0);
  assert.equal(calls, 1);
});

test("a module that is not active does not get the event marked as handled", async () => {
  let calls = 0;
  const { advance, dispatcher, inbox, outbox, unavailable } = setup([
    { consumerName: "kds.create_ticket", handle: async () => void (calls += 1) },
  ]);
  unavailable.add(MODULES.kds);
  const event = outbox.add("order.submitted.v1");

  await dispatcher.dispatchBatch();
  assert.equal(calls, 0);
  assert.equal(event.processedAt, undefined);
  assert.equal(inbox.of("kds.create_ticket")?.status, "RETRYING");
  assert.match(event.lastError ?? "", /Module KDS is not active/);

  // The module is installed in the meantime: the event is delivered.
  unavailable.delete(MODULES.kds);
  advance(1_000);
  await dispatcher.dispatchBatch();
  assert.equal(calls, 1);
  assert.ok(event.processedAt);
});

test("an event that keeps failing is set aside after the last attempt", async () => {
  const { advance, dispatcher, inbox, outbox } = setup([
    {
      consumerName: "kds.create_ticket",
      handle: async () => {
        throw new Error("still broken");
      },
    },
  ]);
  const event = outbox.add("order.submitted.v1");

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    await dispatcher.dispatchBatch();
    advance(options.maxDelayMs);
  }
  assert.ok(event.failedAt);
  assert.equal(event.processedAt, undefined);
  assert.equal(event.attempts, options.maxAttempts);
  assert.equal(inbox.of("kds.create_ticket")?.status, "FAILED");
  // Set aside: never picked up again on its own.
  advance(24 * 60 * 60_000);
  assert.equal(await dispatcher.dispatchBatch(), 0);
});

test("when one of two handlers fails, only that one runs again", async () => {
  const calls = { finance: 0, kds: 0 };
  let financeFails = true;
  const { advance, dispatcher, outbox } = setup([
    { consumerName: "kds.create_ticket", handle: async () => void (calls.kds += 1) },
    {
      consumerName: "finance.post_sale",
      handle: async () => {
        calls.finance += 1;
        if (financeFails) throw new Error("timeout");
      },
      moduleKey: MODULES.financeBasic,
    },
  ]);
  const event = outbox.add("order.submitted.v1");

  await dispatcher.dispatchBatch();
  assert.equal(event.processedAt, undefined);

  financeFails = false;
  advance(1_000);
  await dispatcher.dispatchBatch();
  assert.deepEqual(calls, { finance: 2, kds: 1 });
  assert.ok(event.processedAt);
});

test("a stored error is one bounded line, whatever the handler threw", async () => {
  const { dispatcher, inbox, outbox } = setup([
    {
      consumerName: "kds.create_ticket",
      handle: async () => {
        throw new Error(`line one\nline two ${"x".repeat(900)}`);
      },
    },
  ]);
  const event = outbox.add("order.submitted.v1");
  await dispatcher.dispatchBatch();

  const stored = inbox.of("kds.create_ticket")?.error ?? "";
  assert.ok(stored.length <= 500);
  assert.ok(!stored.includes("\n"));
  assert.ok((event.lastError ?? "").length <= 500);
});

test("a handler name can be registered only once", () => {
  const registry = new EventHandlerRegistry();
  const handler: EventHandler = {
    consumerName: "kds.create_ticket",
    eventType: "order.submitted.v1",
    handle: async () => undefined,
    moduleKey: MODULES.kds,
  };
  registry.register(handler);
  assert.throws(() => registry.register(handler), /registered twice/);
});
