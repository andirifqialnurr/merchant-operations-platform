import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConflictException } from "@nestjs/common";

import type { KitchenTicketRecord } from "../domain/kitchen-ticket.js";
import { CreateKitchenTicket } from "./create-kitchen-ticket.js";
import { KitchenQueue } from "./kitchen-queue.js";
import type { KitchenTicketRepository, NewKitchenTicket } from "./kitchen-ticket.repository.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f975100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f975101";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f975102";
const ACTOR = "019f738d-e61f-7d46-92de-17b35f975103";

class MemoryTickets implements KitchenTicketRepository {
  readonly stored: Array<KitchenTicketRecord & { actorId?: string; reference: string }> = [];

  async create(ticket: NewKitchenTicket) {
    const reference = `${ticket.tenantId} ${ticket.source} ${ticket.sourceReference}`;
    const existing = this.stored.find((item) => item.reference === reference);
    if (existing) return { created: false, ticket: existing };
    const record = {
      acceptedAt: null,
      ...(ticket.actorId ? { actorId: ticket.actorId } : {}),
      canceledAt: null,
      id: randomUUID(),
      items: ticket.items,
      orderLabel: ticket.orderLabel,
      outletId: ticket.outletId,
      readyAt: null,
      receivedAt: ticket.receivedAt,
      reference,
      servedAt: null,
      source: ticket.source,
      startedAt: null,
      status: "NEW" as const,
      tableLabel: ticket.tableLabel,
    };
    this.stored.push(record);
    return { created: true, ticket: record };
  }

  async listOpen(_tenantId: string, outletId: string) {
    return this.stored
      .filter((item) => item.outletId === outletId)
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
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
    counted,
    create: new CreateKitchenTicket(tickets, metering as never),
    queue: new KitchenQueue(tickets),
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
