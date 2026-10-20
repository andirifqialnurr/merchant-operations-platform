import type { FloorPolicy, FloorTableRotation } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { lockTableVisit } from "../../../shared/command/lock-table-visit.js";
import { readDatabase } from "../../../core/read-snapshots/public.js";
import type { ReadSnapshot } from "../../../shared/query/read-snapshot.js";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import {
  eventOrigin,
  type ActorCommandOrigin,
  type CommandOrigin,
} from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";
import {
  TableTakenError,
  type HeldTable,
  type TableSessionRecord,
  type TableSessionRepository,
} from "../application/table-session.repository.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

const sessionSelect = {
  cleanedAt: true,
  displayNumber: true,
  guestCount: true,
  id: true,
  needsCleaning: true,
  openedAt: true,
  status: true,
  tables: {
    orderBy: [{ role: "asc" as const }, { attachedAt: "asc" as const }],
    select: { tableId: true },
    where: { detachedAt: null },
  },
};

type SessionRow = {
  cleanedAt: Date | null;
  displayNumber: number;
  guestCount: number;
  id: string;
  needsCleaning: boolean;
  openedAt: Date;
  status: TableSessionRecord["status"];
  tables: Array<{ tableId: string }>;
};

const toSession = ({ tables, ...row }: SessionRow): TableSessionRecord => ({
  ...row,
  tableIds: tables.map((item) => item.tableId),
});

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function record(
  transaction: Transaction,
  entry: {
    action: string;
    eventType?: string;
    outletId: string;
    payload: Record<string, unknown>;
    sessionId: string;
    tenantId: string;
  },
  origin: CommandOrigin,
) {
  await transaction.auditLog.create({
    data: {
      action: entry.action,
      ...(origin.actorId ? { actorId: origin.actorId } : {}),
      entityId: entry.sessionId,
      entityType: "floor_table_session",
      metadata: buildAuditMetadata(entry.action, buildAuditPayload({ after: entry.payload })),
      outletId: entry.outletId,
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId: entry.tenantId,
    },
  });
  if (entry.eventType) {
    await transaction.outboxEvent.create({
      data: {
        ...eventOrigin(origin, "TABLE_SELF_ORDER"),
        aggregateId: entry.sessionId,
        aggregateType: "floor_table_session",
        outletId: entry.outletId,
        payload: safeEventPayload(entry.payload),
        tenantId: entry.tenantId,
        type: entry.eventType,
      },
    });
  }
}

@Injectable()
export class PrismaTableSessionRepository implements TableSessionRepository {
  async live(tenantId: string, outletId: string): Promise<HeldTable[]> {
    const rows = await getPrismaClient().floorServiceTable.findMany({
      orderBy: { label: "asc" },
      select: {
        area: { select: { floorId: true } },
        areaId: true,
        capacity: true,
        gridH: true,
        gridW: true,
        gridX: true,
        gridY: true,
        id: true,
        label: true,
        qrOrdering: true,
        rotation: true,
        sessions: {
          select: { session: { select: sessionSelect } },
          take: 1,
          where: { detachedAt: null },
        },
        shape: true,
        status: true,
        visualSize: true,
      },
      where: { outletId, tenantId },
    });
    return rows.map(({ area, sessions, ...table }) => ({
      ...table,
      floorId: area.floorId,
      holder: sessions[0] ? toSession(sessions[0].session) : null,
      rotation: table.rotation as FloorTableRotation,
    }));
  }

  async findTable(tenantId: string, outletId: string, tableId: string) {
    const table = await getPrismaClient().floorServiceTable.findFirst({
      select: {
        area: { select: { floor: { select: { status: true } }, status: true } },
        id: true,
        label: true,
        sessions: { select: { id: true }, take: 1, where: { detachedAt: null } },
        status: true,
      },
      where: { id: tableId, outletId, tenantId },
    });
    if (!table) return null;
    return {
      areaActive: table.area.status === "ACTIVE",
      floorActive: table.area.floor.status === "ACTIVE",
      held: table.sessions.length > 0,
      id: table.id,
      label: table.label,
      status: table.status,
    };
  }

  async holderOf(tenantId: string, outletId: string, tableId: string) {
    const held = await getPrismaClient().floorSessionTable.findFirst({
      select: { session: { select: sessionSelect } },
      where: { detachedAt: null, outletId, tableId, tenantId },
    });
    return held ? toSession(held.session) : null;
  }

  async findSession(
    tenantId: string,
    outletId: string,
    sessionId: string,
    snapshot?: ReadSnapshot,
  ) {
    const row = await readDatabase({ tenantId, outletId }, snapshot).floorTableSession.findFirst({
      select: sessionSelect,
      where: { id: sessionId, outletId, tenantId },
    });
    return row ? toSession(row) : null;
  }

  async open(
    tenantId: string,
    outletId: string,
    seat: { guestCount: number; tableId: string },
    origin: CommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const last = await transaction.floorTableSession.aggregate({
          _max: { displayNumber: true },
          where: { outletId, tenantId },
        });
        const session = await transaction.floorTableSession.create({
          data: {
            displayNumber: (last._max.displayNumber ?? 0) + 1,
            guestCount: seat.guestCount,
            ...(origin.actorId ? { openedBy: origin.actorId } : {}),
            outletId,
            tables: { create: { role: "PRIMARY", tableId: seat.tableId } },
            tenantId,
          },
          select: sessionSelect,
        });
        await record(
          transaction,
          {
            action: "floor.table_session.open",
            eventType: "table_session.opened.v1",
            outletId,
            payload: {
              displayNumber: session.displayNumber,
              guestCount: session.guestCount,
              occurredAt: session.openedAt.toISOString(),
              tableIds: [seat.tableId],
            },
            sessionId: session.id,
            tenantId,
          },
          origin,
        );
        return toSession(session);
      });
    } catch (error) {
      // The table is held by another session, or another visit took the number.
      if (isUniqueViolation(error)) throw new TableTakenError();
      throw error;
    }
  }

  async move(
    tenantId: string,
    outletId: string,
    sessionId: string,
    toTableId: string,
    origin: ActorCommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const now = new Date();
        // Locks the visit; a closed one does not move.
        const open = await transaction.floorTableSession.updateMany({
          data: { updatedAt: now },
          where: { id: sessionId, outletId, status: { in: ["OPEN", "CLOSING"] }, tenantId },
        });
        if (open.count !== 1) return null;
        const from = await transaction.floorSessionTable.findFirst({
          select: { id: true, tableId: true },
          where: { detachedAt: null, role: "PRIMARY", sessionId, tenantId },
        });
        if (from) {
          await transaction.floorSessionTable.update({
            data: { detachedAt: now },
            where: { id: from.id },
          });
        }
        // The partial unique index refuses a table another visit holds.
        await transaction.floorSessionTable.create({
          data: { outletId, role: "PRIMARY", sessionId, tableId: toTableId, tenantId },
        });
        await record(
          transaction,
          {
            action: "floor.table_session.move",
            eventType: "table_session.moved.v1",
            outletId,
            payload: {
              fromTableId: from?.tableId ?? null,
              occurredAt: now.toISOString(),
              toTableId,
            },
            sessionId,
            tenantId,
          },
          origin,
        );
        const session = await transaction.floorTableSession.findUniqueOrThrow({
          select: sessionSelect,
          where: { tenantId_id: { id: sessionId, tenantId } },
        });
        return { fromTableId: from?.tableId ?? null, session: toSession(session) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new TableTakenError();
      throw error;
    }
  }

  async close(
    tenantId: string,
    outletId: string,
    sessionId: string,
    change: { needsCleaning: boolean; now: Date },
    origin: ActorCommandOrigin,
    ensureSettled: () => Promise<void>,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      await lockTableVisit(transaction, tenantId, sessionId);
      await ensureSettled();
      const updated = await transaction.floorTableSession.updateMany({
        data: {
          closedAt: change.now,
          closedBy: origin.actorId,
          needsCleaning: change.needsCleaning,
          status: "CLOSED",
          updatedAt: change.now,
        },
        where: { id: sessionId, outletId, status: { in: ["OPEN", "CLOSING"] }, tenantId },
      });
      if (updated.count === 0) return null;
      const tables = await transaction.floorSessionTable.findMany({
        select: { tableId: true },
        where: { detachedAt: null, sessionId, tenantId },
      });
      // Without cleaning the tables are free at once.
      if (!change.needsCleaning) {
        await transaction.floorSessionTable.updateMany({
          data: { detachedAt: change.now },
          where: { detachedAt: null, sessionId, tenantId },
        });
      }
      await record(
        transaction,
        {
          action: "floor.table_session.close",
          eventType: "table_session.closed.v1",
          outletId,
          payload: {
            needsCleaning: change.needsCleaning,
            occurredAt: change.now.toISOString(),
            tableIds: tables.map((item) => item.tableId),
          },
          sessionId,
          tenantId,
        },
        origin,
      );
      return toSession(
        await transaction.floorTableSession.findUniqueOrThrow({
          select: sessionSelect,
          where: { tenantId_id: { id: sessionId, tenantId } },
        }),
      );
    });
  }

  async clean(
    tenantId: string,
    outletId: string,
    tableId: string,
    now: Date,
    origin: CommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const held = await transaction.floorSessionTable.findFirst({
        select: { sessionId: true },
        where: {
          detachedAt: null,
          outletId,
          session: { cleanedAt: null, needsCleaning: true, status: "CLOSED" },
          tableId,
          tenantId,
        },
      });
      if (!held) return null;
      await transaction.floorTableSession.update({
        data: { cleanedAt: now, updatedAt: now },
        where: { tenantId_id: { id: held.sessionId, tenantId } },
      });
      await transaction.floorSessionTable.updateMany({
        data: { detachedAt: now },
        where: { detachedAt: null, sessionId: held.sessionId, tenantId },
      });
      await record(
        transaction,
        {
          action: "floor.table.clean",
          outletId,
          payload: { occurredAt: now.toISOString(), tableId },
          sessionId: held.sessionId,
          tenantId,
        },
        origin,
      );
      return toSession(
        await transaction.floorTableSession.findUniqueOrThrow({
          select: sessionSelect,
          where: { tenantId_id: { id: held.sessionId, tenantId } },
        }),
      );
    });
  }

  async primaryTableLabel(
    tenantId: string,
    outletId: string,
    sessionId: string,
    snapshot?: ReadSnapshot,
  ) {
    const row = await readDatabase({ tenantId, outletId }, snapshot).floorSessionTable.findFirst({
      orderBy: [{ detachedAt: { nulls: "first", sort: "desc" } }, { attachedAt: "desc" }],
      select: { table: { select: { label: true } } },
      where: { outletId, role: "PRIMARY", sessionId, tenantId },
    });
    return row?.table.label ?? null;
  }

  async policy(tenantId: string, outletId: string) {
    const row = await getPrismaClient().floorOutletPolicy.findUnique({
      select: { cleaningAfterClose: true, guestPaymentNote: true },
      where: { tenantId_outletId: { outletId, tenantId } },
    });
    return {
      cleaningAfterClose: row?.cleaningAfterClose ?? false,
      guestPaymentNote: row?.guestPaymentNote ?? null,
    };
  }

  async setPolicy(tenantId: string, outletId: string, policy: FloorPolicy, origin: CommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const saved = await transaction.floorOutletPolicy.upsert({
        create: { ...policy, outletId, tenantId },
        select: { cleaningAfterClose: true, guestPaymentNote: true },
        update: { ...policy, updatedAt: new Date() },
        where: { tenantId_outletId: { outletId, tenantId } },
      });
      await transaction.auditLog.create({
        data: {
          action: "floor.policy.update",
          ...(origin.actorId ? { actorId: origin.actorId } : {}),
          entityId: outletId,
          entityType: "floor_outlet_policy",
          metadata: buildAuditMetadata("floor.policy.update", buildAuditPayload({ after: saved })),
          outletId,
          ...(origin.requestId ? { requestId: origin.requestId } : {}),
          tenantId,
        },
      });
      return saved;
    });
  }
}
