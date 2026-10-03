import { getPrismaClient } from "@merchant/database";

import type { EventEnvelope } from "./event-handler.js";
import type { ClaimedEvent, InboxStatus, InboxStore, OutboxStore } from "./outbox-dispatcher.js";

type OutboxRow = {
  actor_id: string | null;
  actor_type: string | null;
  attempt_count: number;
  causation_id: string | null;
  correlation_id: string | null;
  event_version: number;
  id: string;
  occurred_at: Date;
  outlet_id: string | null;
  payload: unknown;
  producer: string | null;
  recorded_at: Date;
  tenant_id: string;
  type: string;
};

const ACTOR_TYPES = new Set(["DEVICE", "INTEGRATION", "SYSTEM", "USER"]);

function toEnvelope(row: OutboxRow): EventEnvelope {
  return {
    actor:
      row.actor_type && ACTOR_TYPES.has(row.actor_type)
        ? { id: row.actor_id, type: row.actor_type as NonNullable<EventEnvelope["actor"]>["type"] }
        : null,
    causationId: row.causation_id,
    correlationId: row.correlation_id,
    eventId: row.id,
    eventType: row.type,
    eventVersion: row.event_version,
    locationId: row.outlet_id,
    occurredAt: row.occurred_at,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    producer: row.producer,
    recordedAt: row.recorded_at,
    workspaceId: row.tenant_id,
  };
}

export class PrismaOutboxStore implements OutboxStore {
  async claim(limit: number, leaseMs: number, now: Date): Promise<ClaimedEvent[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    // SKIP LOCKED lets several dispatchers work side by side without taking
    // the same event; moving `available_at` hides the event while it is
    // being handled and brings it back if this process dies.
    const rows = await getPrismaClient().$queryRaw<OutboxRow[]>`
      UPDATE "outbox_events" AS e
      SET "available_at" = ${leaseUntil}, "attempt_count" = e."attempt_count" + 1
      WHERE e."id" IN (
        SELECT "id" FROM "outbox_events"
        WHERE "processed_at" IS NULL AND "failed_at" IS NULL AND "available_at" <= ${now}
        ORDER BY "occurred_at", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING e."id", e."tenant_id", e."outlet_id", e."type", e."payload", e."event_version",
        e."correlation_id", e."causation_id", e."actor_type", e."actor_id", e."producer",
        e."recorded_at", e."occurred_at", e."attempt_count"
    `;
    return rows
      .sort((left, right) => left.occurred_at.getTime() - right.occurred_at.getTime())
      .map((row) => ({ attempt: row.attempt_count, envelope: toEnvelope(row) }));
  }

  async markProcessed(eventId: string, now: Date) {
    await getPrismaClient().outboxEvent.update({
      data: { lastError: null, processedAt: now },
      where: { id: eventId },
    });
  }

  async markFailed(eventId: string, error: string, now: Date) {
    await getPrismaClient().outboxEvent.update({
      data: { failedAt: now, lastError: error },
      where: { id: eventId },
    });
  }

  async reschedule(eventId: string, error: string, availableAt: Date) {
    await getPrismaClient().outboxEvent.update({
      data: { availableAt, lastError: error },
      where: { id: eventId },
    });
  }
}

export class PrismaInboxStore implements InboxStore {
  async find(workspaceId: string, consumerName: string, eventId: string) {
    const row = await getPrismaClient().coreInboxEvent.findUnique({
      select: { status: true },
      where: {
        tenantId_consumerName_eventId: { consumerName, eventId, tenantId: workspaceId },
      },
    });
    return (row?.status as InboxStatus | undefined) ?? null;
  }

  async record(entry: {
    consumerName: string;
    error?: string;
    eventId: string;
    eventType: string;
    resultReference?: string;
    status: InboxStatus;
    workspaceId: string;
  }) {
    const now = new Date();
    const outcome = {
      lastError: entry.status === "PROCESSED" ? null : (entry.error ?? "Unknown error"),
      processedAt: entry.status === "PROCESSED" ? now : null,
      resultReference: entry.resultReference ?? null,
      status: entry.status,
      updatedAt: now,
    };
    await getPrismaClient().coreInboxEvent.upsert({
      create: {
        ...outcome,
        consumerName: entry.consumerName,
        eventId: entry.eventId,
        eventType: entry.eventType,
        tenantId: entry.workspaceId,
      },
      update: { ...outcome, attemptCount: { increment: 1 } },
      where: {
        tenantId_consumerName_eventId: {
          consumerName: entry.consumerName,
          eventId: entry.eventId,
          tenantId: entry.workspaceId,
        },
      },
    });
  }
}
