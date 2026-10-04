import assert from "node:assert/strict";
import test from "node:test";

import { EventHandlerRegistry, type EventEnvelope } from "../events/event-handler.js";
import type { MeteringService } from "./metering.service.js";
import { POS_SALES_USAGE_CONSUMER, PosSalesUsageHandler } from "./pos-sales-usage.handler.js";

const EVENT = "019f738d-e61f-7d46-92de-17b35f976010";
const WORKSPACE = "019f738d-e61f-7d46-92de-17b35f976011";
const SALE = "019f738d-e61f-7d46-92de-17b35f976012";

test("a completed sale is counted once per event, in the chain of the sale", async () => {
  const calls: unknown[][] = [];
  const metering = {
    record: async (...args: unknown[]) => {
      calls.push(args);
      return { crossed: [], recorded: true, used: 7n };
    },
  } as unknown as MeteringService;
  const registry = new EventHandlerRegistry();
  new PosSalesUsageHandler(registry, metering).onModuleInit();

  const handler = registry.all().find((item) => item.consumerName === POS_SALES_USAGE_CONSUMER);
  assert.equal(handler?.eventType, "sale.completed.v1");
  assert.equal(handler?.moduleKey, "CORE_SUBSCRIPTION");

  const occurredAt = new Date("2026-10-15T08:00:00.000Z");
  const event: EventEnvelope = {
    actor: { id: null, type: "USER" },
    causationId: null,
    channel: "WEB",
    clientVersion: "1.4.0",
    correlationId: "web_abc",
    deviceId: null,
    eventId: EVENT,
    eventType: "sale.completed.v1",
    eventVersion: 1,
    locationId: null,
    occurredAt,
    payload: { saleId: SALE, totalMinor: "45000" },
    producer: "CORE_BILL",
    recordedAt: occurredAt,
    workspaceId: WORKSPACE,
  };
  assert.equal(await handler?.handle(event), "used:7");
  assert.deepEqual(calls, [
    [
      WORKSPACE,
      {
        dimensionKey: "pos.sales.completed.cycle",
        idempotencyKey: `sale.completed:${EVENT}`,
        occurredAt,
        quantity: 1n,
        sourceReference: SALE,
        sourceType: "sales_sale",
      },
      { causationId: EVENT, channel: "WEB", clientVersion: "1.4.0", requestId: "web_abc" },
    ],
  ]);
});
