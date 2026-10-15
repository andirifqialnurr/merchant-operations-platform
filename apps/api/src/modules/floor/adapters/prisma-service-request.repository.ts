import type { ServiceRequestType } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import {
  eventOrigin,
  type ActorCommandOrigin,
  type CommandOrigin,
} from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";
import type {
  ServiceRequestRecord,
  ServiceRequestRepository,
} from "../application/service-request.repository.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

const select = { id: true, requestedAt: true, sessionId: true, type: true } as const;

async function record(
  transaction: Transaction,
  entry: {
    action: string;
    eventType: string;
    outletId: string;
    request: ServiceRequestRecord;
    tenantId: string;
  },
  origin: CommandOrigin,
) {
  // The visit is the event's aggregate and the audit row names the request.
  const payload = { type: entry.request.type };
  await transaction.auditLog.create({
    data: {
      action: entry.action,
      ...(origin.actorId ? { actorId: origin.actorId } : {}),
      entityId: entry.request.id,
      entityType: "floor_service_request",
      metadata: buildAuditMetadata(entry.action, buildAuditPayload({ after: payload })),
      outletId: entry.outletId,
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId: entry.tenantId,
    },
  });
  await transaction.outboxEvent.create({
    data: {
      ...eventOrigin(origin, "TABLE_SELF_ORDER"),
      aggregateId: entry.request.sessionId,
      aggregateType: "floor_table_session",
      outletId: entry.outletId,
      payload: safeEventPayload(payload),
      tenantId: entry.tenantId,
      type: entry.eventType,
    },
  });
}

@Injectable()
export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  async ask(
    tenantId: string,
    outletId: string,
    sessionId: string,
    type: ServiceRequestType,
    origin: CommandOrigin,
  ): Promise<ServiceRequestRecord> {
    return getPrismaClient().$transaction(async (transaction) => {
      // The partial unique index keeps one open request per visit and type.
      const inserted = await transaction.$queryRaw<ServiceRequestRecord[]>`
        INSERT INTO "floor_service_requests" ("tenant_id", "outlet_id", "session_id", "type")
        VALUES (${tenantId}::uuid, ${outletId}::uuid, ${sessionId}::uuid,
                ${type}::"FloorServiceRequestType")
        ON CONFLICT ("tenant_id", "session_id", "type") WHERE "status" = 'OPEN' DO NOTHING
        RETURNING "id", "requested_at" AS "requestedAt", "session_id" AS "sessionId", "type"`;
      const created = inserted[0];
      if (created) {
        await record(
          transaction,
          {
            action: "floor.service_request.create",
            eventType: "service_request.created.v1",
            outletId,
            request: created,
            tenantId,
          },
          origin,
        );
        return created;
      }
      return transaction.floorServiceRequest.findFirstOrThrow({
        select,
        where: { sessionId, status: "OPEN", tenantId, type },
      });
    });
  }

  async done(
    tenantId: string,
    outletId: string,
    id: string,
    now: Date,
    origin: ActorCommandOrigin,
  ): Promise<ServiceRequestRecord | null> {
    return getPrismaClient().$transaction(async (transaction) => {
      const changed = await transaction.floorServiceRequest.updateMany({
        data: { handledAt: now, handledBy: origin.actorId, status: "DONE" },
        where: { id, outletId, status: "OPEN", tenantId },
      });
      if (changed.count === 0) return null;
      const request = await transaction.floorServiceRequest.findFirstOrThrow({
        select,
        where: { id, tenantId },
      });
      await record(
        transaction,
        {
          action: "floor.service_request.done",
          eventType: "service_request.done.v1",
          outletId,
          request,
          tenantId,
        },
        origin,
      );
      return request;
    });
  }

  async openAt(tenantId: string, outletId: string): Promise<ServiceRequestRecord[]> {
    return getPrismaClient().floorServiceRequest.findMany({
      orderBy: { requestedAt: "asc" },
      select,
      where: { outletId, session: { status: { not: "CLOSED" } }, status: "OPEN", tenantId },
    });
  }

  async openFor(tenantId: string, sessionId: string): Promise<ServiceRequestType[]> {
    const rows = await getPrismaClient().floorServiceRequest.findMany({
      orderBy: { requestedAt: "asc" },
      select: { type: true },
      where: { sessionId, status: "OPEN", tenantId },
    });
    return rows.map((row) => row.type);
  }
}
