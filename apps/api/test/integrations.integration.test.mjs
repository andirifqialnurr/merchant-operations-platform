import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import process from "node:process";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaBindingRepository } from "../src/core/integrations/binding.repository.ts";

test("retry recovers only the selected binding's held deliveries in disposable PostgreSQL", async () => {
  await withDisposablePostgres(async ({ connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const tenant = await db.tenant.create({ data: { name: "Retry test", slug: randomUUID() } });
      const other = await db.tenant.create({
        data: { name: "Other business", slug: randomUUID() },
      });
      const effectiveFrom = new Date("2026-10-01T00:00:00Z");
      const binding = await db.coreIntegrationBinding.create({
        data: {
          tenantId: tenant.id,
          sourceModuleKey: "CORE_ORDER",
          targetModuleKey: "KDS",
          eventType: "order.submitted.v1",
          handlerKey: "kds.create_ticket",
          effectiveFrom,
          effectiveTo: new Date("2026-11-01T00:00:00Z"),
          status: "PAUSED",
          health: "BLOCKED",
        },
      });
      async function delivery(tenantId, consumerName, status, occurredAt, inFlight = false) {
        const event = await db.outboxEvent.create({
          data: {
            tenantId,
            type: "order.submitted.v1",
            aggregateType: "order",
            aggregateId: randomUUID(),
            payload: {},
            occurredAt,
            processedAt: inFlight ? null : new Date(),
            availableAt: new Date(Date.now() + 60_000),
            attemptCount: 8,
          },
        });
        await db.coreInboxEvent.create({
          data: {
            tenantId,
            consumerName,
            status,
            lastError: status === "PROCESSED" ? null : "Delivery held for recovery.",
            processedAt: status === "PROCESSED" ? new Date() : null,
            eventId: event.id,
            eventType: event.type,
          },
        });
        return event;
      }
      const held = await delivery(tenant.id, binding.handlerKey, "BLOCKED", effectiveFrom);
      const failed = await delivery(tenant.id, binding.handlerKey, "FAILED", effectiveFrom);
      await db.outboxEvent.update({
        where: { id: failed.id },
        data: { processedAt: null, failedAt: new Date() },
      });
      // A successful second consumer of the same event must never run twice.
      await db.coreInboxEvent.create({
        data: {
          tenantId: tenant.id,
          consumerName: "finance.record_sale",
          status: "PROCESSED",
          processedAt: new Date(),
          eventId: held.id,
          eventType: held.type,
        },
      });
      const untouched = [
        await delivery(other.id, binding.handlerKey, "BLOCKED", effectiveFrom),
        await delivery(tenant.id, "another.consumer", "BLOCKED", effectiveFrom),
        await delivery(tenant.id, binding.handlerKey, "PROCESSED", effectiveFrom),
        await delivery(tenant.id, binding.handlerKey, "BLOCKED", new Date("2026-09-01T00:00:00Z")),
        await delivery(tenant.id, binding.handlerKey, "BLOCKED", effectiveFrom, true),
        await delivery(tenant.id, binding.handlerKey, "BLOCKED", new Date("2026-11-01T00:00:00Z")),
      ];
      const repo = new PrismaBindingRepository();
      const retry = () =>
        repo.setStatus(
          tenant.id,
          binding.id,
          "PAUSED",
          {
            status: "ACTIVE",
            health: "STALE",
            lastError: null,
          },
          { action: "integration_binding.retry", retryHeld: true },
        );
      const results = await Promise.all([retry(), retry()]);
      assert.equal(results.filter(Boolean).length, 1, "concurrent recovery changes status once");
      const recovered = await db.outboxEvent.findUniqueOrThrow({ where: { id: held.id } });
      assert.equal(recovered.processedAt, null);
      assert.equal(recovered.attemptCount, 0);
      assert.ok(recovered.availableAt <= new Date());
      const recoveredFailure = await db.outboxEvent.findUniqueOrThrow({ where: { id: failed.id } });
      assert.equal(recoveredFailure.failedAt, null);
      assert.equal(recoveredFailure.processedAt, null);
      assert.equal(recoveredFailure.attemptCount, 0);
      const receipts = await db.coreInboxEvent.findMany({ where: { eventId: held.id } });
      assert.equal(receipts.find((r) => r.consumerName === binding.handlerKey).status, "RETRYING");
      assert.equal(
        receipts.find((r) => r.consumerName === "finance.record_sale").status,
        "PROCESSED",
      );
      for (const original of untouched) {
        const actual = await db.outboxEvent.findUniqueOrThrow({ where: { id: original.id } });
        assert.deepEqual(actual, original);
      }
      assert.equal(
        await db.auditLog.count({
          where: { tenantId: tenant.id, action: "integration_binding.retry" },
        }),
        1,
      );
      assert.equal(await repo.findById(other.id, binding.id), null);
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
