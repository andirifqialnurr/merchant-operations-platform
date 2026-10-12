import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { KitchenTicketStatus } from "@merchant/contracts";
import { ConflictException, NotFoundException } from "@nestjs/common";

import { OPEN_TICKET_STATUSES, type KitchenTicketRecord } from "../domain/kitchen-ticket.js";
import { isFinished, startOfLocalDay, STATUS_TIMESTAMP } from "../domain/ticket-status.js";
import { AdvanceKitchenTicket } from "./advance-kitchen-ticket.js";
import { CreateKitchenTicket } from "./create-kitchen-ticket.js";
import { KitchenQueue } from "./kitchen-queue.js";
import type {
  KitchenTicketRepository,
  NewKitchenTicket,
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
