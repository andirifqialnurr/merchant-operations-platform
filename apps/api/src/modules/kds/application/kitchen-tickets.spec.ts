import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { KitchenTicketStatus } from "@merchant/contracts";
import { ConflictException, NotFoundException } from "@nestjs/common";

import { OPEN_TICKET_STATUSES, type KitchenTicketRecord } from "../domain/kitchen-ticket.js";
import { isFinished, startOfLocalDay, STATUS_TIMESTAMP } from "../domain/ticket-status.js";
import { kitchenOrderSource } from "../../../kernel-wiring.module.js";
import {
  BlockedEventError,
  EventHandlerRegistry,
  type EventEnvelope,
} from "../../../core/events/public.js";
import { OrderEventsHandler } from "../adapters/order-events.handler.js";
import { AdvanceKitchenTicket } from "./advance-kitchen-ticket.js";
import { CancelKitchenTicket } from "./cancel-kitchen-ticket.js";
import type { KitchenOrder } from "./kitchen-order-source.port.js";
import { CreateKitchenTicket } from "./create-kitchen-ticket.js";
import { KitchenQueue } from "./kitchen-queue.js";
import type {
  KitchenTicketRepository,
  NewKitchenTicket,
  TicketCancellation,
  TicketMove,
  TicketMoveResult,
} from "./kitchen-ticket.repository.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f975100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f975101";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f975102";
const ACTOR = "019f738d-e61f-7d46-92de-17b35f975103";

class MemoryTickets implements KitchenTicketRepository {
  readonly stored: Array<KitchenTicketRecord & { actorId?: string }> = [];
  readonly history: Array<{
    actorId?: string;
    from: KitchenTicketStatus;
    to: KitchenTicketStatus;
  }> = [];
  readonly events: Array<{ ticketId: string; type: string }> = [];

  async create(ticket: NewKitchenTicket) {
    const existing = this.stored.find(
      (item) => item.source === ticket.source && item.sourceReference === ticket.sourceReference,
    );
    if (existing) return { created: false, ticket: existing };
    const record: KitchenTicketRecord & { actorId?: string } = {
      acceptedAt: null,
      ...(ticket.actorId ? { actorId: ticket.actorId } : {}),
      canceledAt: null,
      id: randomUUID(),
      items: ticket.items,
      orderLabel: ticket.orderLabel,
      outletId: ticket.outletId,
      readyAt: null,
      receivedAt: ticket.receivedAt,
      servedAt: null,
      source: ticket.source,
      sourceReference: ticket.sourceReference,
      startedAt: null,
      status: "NEW",
      tableLabel: ticket.tableLabel,
    };
    this.stored.push(record);
    return { created: true, ticket: record };
  }

  async move(move: TicketMove): Promise<TicketMoveResult> {
    const ticket = this.stored.find(
      (item) => item.id === move.id && item.outletId === move.outletId,
    );
    if (!ticket) return { outcome: "missing" };
    if (ticket.status !== move.from) return { outcome: "stale", ticket };
    ticket.status = move.to;
    if (move.to !== "NEW") ticket[STATUS_TIMESTAMP[move.to]] = move.at;
    this.history.push({
      ...(move.origin?.actorId ? { actorId: move.origin.actorId } : {}),
      from: move.from,
      to: move.to,
    });
    if (move.eventType) this.events.push({ ticketId: ticket.id, type: move.eventType });
    return { outcome: "moved", ticket };
  }

  async cancelBySource(cancellation: TicketCancellation) {
    const ticket = this.stored.find(
      (item) =>
        cancellation.sources.includes(item.source) &&
        item.sourceReference === cancellation.sourceReference,
    );
    if (!ticket) return "no_ticket" as const;
    if (ticket.status === "CANCELED") return "already_canceled" as const;
    if (ticket.status === "SERVED") return "already_served" as const;
    this.history.push({ from: ticket.status, to: "CANCELED" });
    ticket.status = "CANCELED";
    ticket.canceledAt = cancellation.at;
    return "canceled" as const;
  }

  async listOpen(_tenantId: string, outletId: string) {
    return this.stored
      .filter((item) => item.outletId === outletId)
      .filter((item) => (OPEN_TICKET_STATUSES as readonly string[]).includes(item.status))
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  }

  async listFinishedSince(_tenantId: string, outletId: string, since: Date) {
    return this.stored
      .filter((item) => item.outletId === outletId && isFinished(item.status))
      .filter((item) => (item.servedAt ?? item.canceledAt ?? new Date(0)) >= since)
      .sort((a, b) => (b.servedAt?.getTime() ?? 0) - (a.servedAt?.getTime() ?? 0));
  }
}

function setup() {
  const tickets = new MemoryTickets();
  const counted: string[] = [];
  const metering = {
    record: async (_tenantId: string, event: { idempotencyKey: string }) => {
      const first = !counted.includes(event.idempotencyKey);
      if (first) counted.push(event.idempotencyKey);
      return { counted: first, crossed: [], used: BigInt(counted.length) };
    },
  };
  return {
    advance: new AdvanceKitchenTicket(tickets),
    cancel: new CancelKitchenTicket(tickets),
    counted,
    create: new CreateKitchenTicket(tickets, metering as never),
    queue: new KitchenQueue(tickets, { outletTimezone: async () => "Asia/Jakarta" }),
    tickets,
  };
}

const latte = {
  modifiers: ["Besar", "Gula aren"],
  name: "Latte",
  note: "kurang manis",
  quantity: 2,
};

test("a ticket is made new, with its items as the kitchen reads them", async () => {
  const { create, tickets } = setup();
  const { created, ticket } = await create.execute(
    TENANT,
    OUTLET,
    {
      items: [latte, { name: "Roti bakar", quantity: 1 }],
      orderLabel: "A-12",
      receivedAt: "2026-10-12T03:00:00.000Z",
      source: "POS",
      sourceReference: "order-1",
      tableLabel: "Meja 4",
    },
    { actorId: ACTOR },
  );

  assert.equal(created, true);
  assert.equal(ticket.status, "NEW");
  assert.equal(ticket.receivedAt, "2026-10-12T03:00:00.000Z");
  assert.deepEqual(ticket.items, [
    { allergyNote: null, ...latte },
    { allergyNote: null, modifiers: [], name: "Roti bakar", note: null, quantity: 1 },
  ]);
  assert.equal(ticket.tableLabel, "Meja 4");
  assert.equal(tickets.stored[0]?.actorId, ACTOR);
});

test("the same source and reference make one ticket and are counted once", async () => {
  const { counted, create, tickets } = setup();
  const input = {
    items: [latte],
    orderLabel: "A-12",
    source: "POS" as const,
    sourceReference: "order-1",
  };
  const first = await create.execute(TENANT, OUTLET, input);
  // The repeat even differs in content: what was made first stays.
  const second = await create.execute(TENANT, OUTLET, { ...input, orderLabel: "A-99" });

  assert.equal(second.created, false);
  assert.equal(second.ticket.id, first.ticket.id);
  assert.equal(second.ticket.orderLabel, "A-12");
  assert.equal(tickets.stored.length, 1);
  assert.deepEqual(counted, [`kds.ticket:${first.ticket.id}`]);
});

test("the same reference from another source is another ticket", async () => {
  const { create, tickets } = setup();
  const input = { items: [latte], orderLabel: "A-12", sourceReference: "1" };
  await create.execute(TENANT, OUTLET, { ...input, source: "POS" });
  await create.execute(TENANT, OUTLET, { ...input, source: "API" });
  assert.equal(tickets.stored.length, 2);
});

test("a reference already used at another outlet is refused, not shown there", async () => {
  const { create } = setup();
  const input = {
    items: [latte],
    orderLabel: "A-12",
    source: "MANUAL" as const,
    sourceReference: "same-key-0000000000",
  };
  await create.execute(TENANT, OUTLET, input);
  await assert.rejects(create.execute(TENANT, OTHER_OUTLET, input), (error) => {
    assert.ok(error instanceof ConflictException);
    assert.equal((error.getResponse() as { code: string }).code, "KITCHEN_TICKET_REFERENCE_USED");
    return true;
  });
});

test("every way in is held to the same rules", async () => {
  const { create, tickets } = setup();
  const base = { orderLabel: "A-12", source: "API" as const, sourceReference: "ref-1" };
  await assert.rejects(create.execute(TENANT, OUTLET, { ...base, items: [] }));
  await assert.rejects(
    create.execute(TENANT, OUTLET, { ...base, items: [{ name: "Latte", quantity: 0 }] }),
  );
  await assert.rejects(
    create.execute(TENANT, OUTLET, {
      ...base,
      // A price has no place on a ticket, whoever sends it.
      items: [{ name: "Latte", quantity: 1, unitPriceMinor: "25000" } as never],
    }),
  );
  assert.equal(tickets.stored.length, 0);
});

test("the queue lists an outlet's tickets, longest waiting first", async () => {
  const { create, queue } = setup();
  const at = (minute: number, label: string, outlet = OUTLET) =>
    create.execute(TENANT, outlet, {
      items: [latte],
      orderLabel: label,
      receivedAt: `2026-10-12T03:${String(minute).padStart(2, "0")}:00.000Z`,
      source: "MANUAL",
      sourceReference: `key-${label}-000000000000`,
    });
  await at(20, "kedua");
  await at(5, "pertama");
  await at(1, "outlet lain", OTHER_OUTLET);

  const { tickets } = await queue.list(TENANT, OUTLET);
  assert.deepEqual(
    tickets.map((ticket) => ticket.orderLabel),
    ["pertama", "kedua"],
  );
});

const codeOf = (error: unknown) =>
  (error as { getResponse(): { code: string } }).getResponse().code;

test("a ticket moves one step at a time and announces what others need to know", async () => {
  const { advance, create, tickets } = setup();
  const { ticket } = await create.execute(TENANT, OUTLET, {
    items: [latte],
    orderLabel: "A-12",
    source: "POS",
    sourceReference: "order-1",
  });
  const at = (minute: number) => new Date(`2026-10-12T03:0${minute}:00.000Z`);
  const step = (from: "NEW" | "ACCEPTED" | "PREPARING" | "READY", minute: number) =>
    advance.execute(TENANT, OUTLET, ticket.id, from, { actorId: ACTOR }, at(minute));

  const accepted = await step("NEW", 1);
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.acceptedAt, at(1).toISOString());
  const preparing = await step("ACCEPTED", 2);
  const ready = await step("PREPARING", 5);
  const served = await step("READY", 6);

  assert.deepEqual(
    [preparing.status, ready.status, served.status],
    ["PREPARING", "READY", "SERVED"],
  );
  assert.deepEqual(
    [served.startedAt, served.readyAt, served.servedAt],
    [at(2).toISOString(), at(5).toISOString(), at(6).toISOString()],
  );
  assert.deepEqual(
    tickets.history.map((row) => `${row.from}>${row.to}`),
    ["NEW>ACCEPTED", "ACCEPTED>PREPARING", "PREPARING>READY", "READY>SERVED"],
  );
  assert.equal(tickets.history[0]?.actorId, ACTOR);
  // Accepting is the kitchen's own business; the other three are announced.
  assert.deepEqual(
    tickets.events.map((event) => event.type),
    ["kitchen_ticket.started.v1", "kitchen_ticket.ready.v1", "kitchen_ticket.served.v1"],
  );
});

test("a second tap changes nothing, and an older view cannot skip a step", async () => {
  const { advance, create, tickets } = setup();
  const { ticket } = await create.execute(TENANT, OUTLET, {
    items: [latte],
    orderLabel: "A-12",
    source: "MANUAL",
    sourceReference: "manual-key-00000001",
  });
  await advance.execute(TENANT, OUTLET, ticket.id, "NEW");
  // The same tap again: the ticket is already where the tap wanted it.
  const again = await advance.execute(TENANT, OUTLET, ticket.id, "NEW");
  assert.equal(again.status, "ACCEPTED");
  assert.equal(tickets.history.length, 1);

  await advance.execute(TENANT, OUTLET, ticket.id, "ACCEPTED");
  await advance.execute(TENANT, OUTLET, ticket.id, "PREPARING");
  // A screen that still shows the ticket as new is told it changed.
  await assert.rejects(advance.execute(TENANT, OUTLET, ticket.id, "NEW"), (error) => {
    assert.ok(error instanceof ConflictException);
    assert.equal(codeOf(error), "KITCHEN_TICKET_STATUS_CHANGED");
    assert.deepEqual((error.getResponse() as { details: unknown }).details, { status: "READY" });
    return true;
  });
  assert.equal(tickets.history.length, 3);
});

test("a finished ticket has no next step, and another outlet cannot move a ticket", async () => {
  const { advance, create } = setup();
  const { ticket } = await create.execute(TENANT, OUTLET, {
    items: [latte],
    orderLabel: "A-12",
    source: "MANUAL",
    sourceReference: "manual-key-00000002",
  });
  for (const finished of ["SERVED", "CANCELED"] as const) {
    await assert.rejects(advance.execute(TENANT, OUTLET, ticket.id, finished), (error) => {
      assert.equal(codeOf(error), "KITCHEN_TICKET_FINISHED");
      return true;
    });
  }
  await assert.rejects(advance.execute(TENANT, OTHER_OUTLET, ticket.id, "NEW"), (error) => {
    assert.ok(error instanceof NotFoundException);
    assert.equal(codeOf(error), "KITCHEN_TICKET_NOT_FOUND");
    return true;
  });
});

test("a served ticket leaves the queue and is listed as finished today", async () => {
  const { advance, create, queue } = setup();
  const make = async (label: string) =>
    (
      await create.execute(TENANT, OUTLET, {
        items: [latte],
        orderLabel: label,
        source: "MANUAL",
        sourceReference: `manual-key-${label}-0000000`,
      })
    ).ticket;
  const yesterday = await make("kemarin");
  const today = await make("hari-ini");
  await make("masih-jalan");
  const serve = async (id: string, at: Date) => {
    for (const status of ["NEW", "ACCEPTED", "PREPARING", "READY"] as const) {
      await advance.execute(TENANT, OUTLET, id, status, undefined, at);
    }
  };
  // 23:30 and 00:30 in Jakarta: either side of the outlet's midnight.
  await serve(yesterday.id, new Date("2026-10-11T16:30:00.000Z"));
  await serve(today.id, new Date("2026-10-11T17:30:00.000Z"));

  const now = new Date("2026-10-12T03:00:00.000Z");
  assert.deepEqual(
    (await queue.list(TENANT, OUTLET)).tickets.map((ticket) => ticket.orderLabel),
    ["masih-jalan"],
  );
  assert.deepEqual(
    (await queue.finishedToday(TENANT, OUTLET, now)).tickets.map((ticket) => ticket.orderLabel),
    ["hari-ini"],
  );
});

test("the day begins at the outlet's own midnight", () => {
  const now = new Date("2026-10-12T03:15:20.500Z");
  assert.equal(startOfLocalDay(now, "Asia/Jakarta").toISOString(), "2026-10-11T17:00:00.000Z");
  assert.equal(startOfLocalDay(now, "Asia/Jayapura").toISOString(), "2026-10-11T15:00:00.000Z");
  assert.equal(startOfLocalDay(now, "UTC").toISOString(), "2026-10-12T00:00:00.000Z");
});

// --- Orders reaching the kitchen as events ---------------------------------

const ORDER = "019f738d-e61f-7d46-92de-17b35f975200";

const event = (type: string, overrides: Partial<EventEnvelope> = {}): EventEnvelope => ({
  actor: null,
  causationId: null,
  channel: "POS",
  clientVersion: null,
  correlationId: "req_1",
  deviceId: null,
  eventId: randomUUID(),
  eventType: type,
  eventVersion: 1,
  locationId: OUTLET,
  occurredAt: new Date("2026-10-12T03:00:00.000Z"),
  payload: { orderId: ORDER },
  producer: "CORE_ORDER",
  recordedAt: new Date("2026-10-12T03:00:01.000Z"),
  workspaceId: TENANT,
  ...overrides,
});

function kitchen(order: KitchenOrder | null) {
  const parts = setup();
  const registry = new EventHandlerRegistry();
  const asked: string[] = [];
  new OrderEventsHandler(registry, parts.create, parts.cancel, {
    kitchenOrder: async (_tenantId, outletId, orderId) => {
      asked.push(`${outletId} ${orderId}`);
      return order;
    },
  }).onModuleInit();
  const run = (envelope: EventEnvelope) => {
    const handler = registry.for(envelope.eventType)[0];
    assert.ok(handler, `a handler for ${envelope.eventType}`);
    return handler.handle(envelope);
  };
  return { ...parts, asked, registry, run };
}

const latteOrder: KitchenOrder = {
  canceled: false,
  items: [{ modifiers: ["Besar", "Gula aren"], name: "Latte", note: "kurang manis", quantity: 2 }],
  orderLabel: "#12",
  source: "POS",
};

test("a submitted order becomes a ticket through the same use case as the manual form", async () => {
  const { asked, create, registry, run, tickets } = kitchen(latteOrder);
  assert.deepEqual(
    registry.all().map((item) => `${item.moduleKey} ${item.eventType} ${item.consumerName}`),
    ["KDS order.submitted.v1 kds.create_ticket", "KDS order.canceled.v1 kds.cancel_ticket"],
  );

  const outcome = await run(event("order.submitted.v1"));
  assert.match(String(outcome), /^created:/);
  assert.deepEqual(asked, [`${OUTLET} ${ORDER}`]);

  // The same items typed by hand give the same ticket, apart from where it came from.
  const manual = await create.execute(TENANT, OUTLET, {
    items: latteOrder.items,
    orderLabel: "#12",
    receivedAt: "2026-10-12T03:00:00.000Z",
    source: "MANUAL",
    sourceReference: "manual-key-00000009",
  });
  const fromEvent = tickets.stored[0];
  assert.ok(fromEvent);
  assert.deepEqual(
    { ...manual.ticket, id: null, source: null },
    {
      acceptedAt: null,
      canceledAt: null,
      id: null,
      items: fromEvent.items,
      orderLabel: fromEvent.orderLabel,
      readyAt: null,
      receivedAt: fromEvent.receivedAt.toISOString(),
      servedAt: null,
      source: null,
      startedAt: null,
      status: fromEvent.status,
      tableLabel: fromEvent.tableLabel,
    },
  );
  assert.equal(fromEvent.source, "POS");
  assert.equal(fromEvent.sourceReference, ORDER);
});

test("the same order event delivered twice makes one ticket", async () => {
  const { counted, run, tickets } = kitchen(latteOrder);
  const submitted = event("order.submitted.v1");
  const first = await run(submitted);
  // Once as a redelivery of the same event, once as a new event about the same order.
  const second = await run(submitted);
  const third = await run(event("order.submitted.v1"));

  assert.equal(tickets.stored.length, 1);
  assert.equal(counted.length, 1);
  assert.match(String(first), /^created:/);
  assert.equal(second, String(first).replace("created", "existing"));
  assert.equal(third, second);
});

test("an event that cannot be turned into a ticket is blocked, not retried forever", async () => {
  const missing = kitchen(null);
  await assert.rejects(missing.run(event("order.submitted.v1")), BlockedEventError);
  await assert.rejects(
    missing.run(event("order.submitted.v1", { payload: {} })),
    BlockedEventError,
  );
  await assert.rejects(
    missing.run(event("order.submitted.v1", { locationId: null })),
    BlockedEventError,
  );
  assert.equal(missing.tickets.stored.length, 0);
});

test("an order called off before the kitchen heard of it makes no ticket", async () => {
  const { run, tickets } = kitchen({ ...latteOrder, canceled: true });
  assert.equal(await run(event("order.submitted.v1")), "skipped:order_canceled");
  assert.equal(tickets.stored.length, 0);
});

test("a canceled order marks its ticket canceled and keeps it", async () => {
  const { queue, run, tickets } = kitchen(latteOrder);
  await run(event("order.submitted.v1"));
  const canceledAt = new Date("2026-10-12T03:04:00.000Z");

  assert.equal(await run(event("order.canceled.v1", { occurredAt: canceledAt })), "canceled");
  assert.equal(tickets.stored.length, 1, "the ticket is still there");
  assert.equal(tickets.stored[0]?.status, "CANCELED");
  assert.deepEqual(tickets.stored[0]?.canceledAt, canceledAt);
  assert.deepEqual(tickets.history.at(-1), { from: "NEW", to: "CANCELED" });
  // Out of the queue, into what was finished today.
  assert.deepEqual((await queue.list(TENANT, OUTLET)).tickets, []);
  const finished = await queue.finishedToday(TENANT, OUTLET, new Date("2026-10-12T04:00:00.000Z"));
  assert.deepEqual(
    finished.tickets.map((ticket) => ticket.status),
    ["CANCELED"],
  );

  // Delivered again: nothing more happens.
  assert.equal(await run(event("order.canceled.v1")), "already_canceled");
  assert.equal(tickets.history.length, 1);
});

test("a cancellation never un-serves food, and an order without a ticket is no error", async () => {
  const { advance, run, tickets } = kitchen(latteOrder);
  assert.equal(await run(event("order.canceled.v1")), "no_ticket");

  await run(event("order.submitted.v1"));
  const id = tickets.stored[0]?.id ?? "";
  for (const status of ["NEW", "ACCEPTED", "PREPARING", "READY"] as const) {
    await advance.execute(TENANT, OUTLET, id, status);
  }
  assert.equal(await run(event("order.canceled.v1")), "already_served");
  assert.equal(tickets.stored[0]?.status, "SERVED");
});

test("a hand-made ticket is not canceled by an order with the same reference", async () => {
  const { create, run, tickets } = kitchen(latteOrder);
  await create.execute(TENANT, OUTLET, {
    items: latteOrder.items,
    orderLabel: "Meja 4",
    source: "MANUAL",
    sourceReference: ORDER,
  });
  assert.equal(await run(event("order.canceled.v1")), "no_ticket");
  assert.equal(tickets.stored[0]?.status, "NEW");
});

test("what the kitchen is told about an order has no price in it", async () => {
  const order = {
    canceledAt: null,
    cancelReason: null,
    createdAt: "2026-10-12T03:00:00.000Z",
    currency: "IDR",
    id: ORDER,
    items: [
      {
        id: randomUUID(),
        lineTotalMinor: "68000",
        modifiers: [{ groupName: "Tambahan", optionName: "Gula aren", priceDeltaMinor: "3000" }],
        name: "Latte",
        note: "kurang manis",
        productId: randomUUID(),
        quantity: 2,
        unitPriceMinor: "34000",
        variantName: "Besar",
      },
      {
        id: randomUUID(),
        lineTotalMinor: "15000",
        modifiers: [],
        name: "Roti bakar",
        note: null,
        productId: null,
        quantity: 1,
        unitPriceMinor: "15000",
        variantName: null,
      },
    ],
    note: null,
    orderNumber: 12,
    orderType: "TAKEAWAY",
    outletId: OUTLET,
    source: "POS",
    status: "SUBMITTED",
    submittedAt: "2026-10-12T03:00:00.000Z",
    subtotalMinor: "83000",
  } as const;
  const source = kitchenOrderSource({ getOrder: async () => order as never });
  const seen = await source.kitchenOrder(TENANT, OUTLET, ORDER);

  assert.deepEqual(seen, {
    canceled: false,
    items: [
      // The variant is read first, then the chosen options.
      { modifiers: ["Besar", "Gula aren"], name: "Latte", note: "kurang manis", quantity: 2 },
      { modifiers: [], name: "Roti bakar", quantity: 1 },
    ],
    orderLabel: "#12",
    source: "POS",
  });
  assert.doesNotMatch(JSON.stringify(seen), /minor|price|total|34000|68000|83000|IDR/i);

  const missing = kitchenOrderSource({
    getOrder: async () => {
      throw new NotFoundException();
    },
  });
  assert.equal(await missing.kitchenOrder(TENANT, OUTLET, ORDER), null);
  const canceled = kitchenOrderSource({
    getOrder: async () => ({ ...order, status: "CANCELED" }) as never,
  });
  assert.equal((await canceled.kitchenOrder(TENANT, OUTLET, ORDER))?.canceled, true);
});
