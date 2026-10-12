import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { eventOrigin } from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";
import type {
  KitchenTicketRepository,
  NewKitchenTicket,
  TicketMove,
  TicketMoveResult,
} from "../application/kitchen-ticket.repository.js";
import { STATUS_TIMESTAMP } from "../domain/ticket-status.js";
import {
  DEFAULT_STATION_NAME,
  OPEN_TICKET_STATUSES,
  type KitchenTicketRecord,
} from "../domain/kitchen-ticket.js";

const ticketSelect = {
  acceptedAt: true,
  canceledAt: true,
  id: true,
  items: {
    orderBy: { position: "asc" },
    select: { allergyNote: true, modifiers: true, nameSnapshot: true, note: true, quantity: true },
  },
  orderLabel: true,
  outletId: true,
  readyAt: true,
  receivedAt: true,
  servedAt: true,
  source: true,
  sourceReference: true,
  startedAt: true,
  status: true,
  tableLabel: true,
} as const;

type TicketRow = Omit<KitchenTicketRecord, "items"> & {
  items: Array<{
    allergyNote: string | null;
    modifiers: unknown;
    nameSnapshot: string;
    note: string | null;
    quantity: number;
  }>;
};

function toRecord({ items, ...row }: TicketRow): KitchenTicketRecord {
  return {
    ...row,
    items: items.map((item) => ({
      allergyNote: item.allergyNote,
      // Stored as a JSON array of names; anything else is not shown.
      modifiers: Array.isArray(item.modifiers)
        ? item.modifiers.filter((name): name is string => typeof name === "string")
        : [],
      name: item.nameSnapshot,
      note: item.note,
      quantity: item.quantity,
    })),
  };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class PrismaKitchenTicketRepository implements KitchenTicketRepository {
  private bySource(ticket: Pick<NewKitchenTicket, "source" | "sourceReference" | "tenantId">) {
    return getPrismaClient().kdsTicket.findUnique({
      select: ticketSelect,
      where: {
        tenantId_source_sourceReference: {
          source: ticket.source,
          sourceReference: ticket.sourceReference,
          tenantId: ticket.tenantId,
        },
      },
    });
  }

  /** The outlet's default station, made the first time it is needed. */
  private async defaultStationId(tenantId: string, outletId: string) {
    const prisma = getPrismaClient();
    const find = () =>
      prisma.kdsStation.findFirst({
        select: { id: true },
        where: { isDefault: true, outletId, tenantId },
      });
    const existing = await find();
    if (existing) return existing.id;
    try {
      const created = await prisma.kdsStation.create({
        data: { isDefault: true, name: DEFAULT_STATION_NAME, outletId, tenantId },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Two first tickets arrived together; the other one made the station.
      const raced = await find();
      if (!raced) throw error;
      return raced.id;
    }
  }

  async create(ticket: NewKitchenTicket) {
    const existing = await this.bySource(ticket);
    if (existing) return { created: false, ticket: toRecord(existing) };

    const stationId = await this.defaultStationId(ticket.tenantId, ticket.outletId);
    try {
      const created = await getPrismaClient().kdsTicket.create({
        data: {
          items: {
            create: ticket.items.map((item, position) => ({
              allergyNote: item.allergyNote,
              modifiers: item.modifiers,
              nameSnapshot: item.name,
              note: item.note,
              position,
              quantity: item.quantity,
            })),
          },
          orderLabel: ticket.orderLabel,
          outletId: ticket.outletId,
          receivedAt: ticket.receivedAt,
          source: ticket.source,
          sourceReference: ticket.sourceReference,
          stationId,
          statusHistory: {
            create: {
              ...(ticket.actorId ? { actorId: ticket.actorId } : {}),
              occurredAt: ticket.receivedAt,
              toStatus: "NEW",
            },
          },
          tableLabel: ticket.tableLabel,
          tenantId: ticket.tenantId,
        },
        select: ticketSelect,
      });
      return { created: true, ticket: toRecord(created) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // The same request arrived twice at once; the other one made the ticket.
      const raced = await this.bySource(ticket);
      if (!raced) throw error;
      return { created: false, ticket: toRecord(raced) };
    }
  }

  async move(move: TicketMove): Promise<TicketMoveResult> {
    const { at, from, id, outletId, tenantId, to } = move;
    const where = { id, outletId, tenantId };
    const column = to === "NEW" ? undefined : STATUS_TIMESTAMP[to];
    return getPrismaClient().$transaction(async (transaction) => {
      // Only a ticket still in `from` moves; of two moves at once, one finds nothing.
      const moved = await transaction.kdsTicket.updateMany({
        data: { status: to, updatedAt: at, ...(column ? { [column]: at } : {}) },
        where: { ...where, status: from },
      });
      const ticket = await transaction.kdsTicket.findFirst({ select: ticketSelect, where });
      if (!ticket) return { outcome: "missing" };
      if (moved.count !== 1) return { outcome: "stale", ticket: toRecord(ticket) };

      await transaction.kdsTicketStatusHistory.create({
        data: {
          ...(move.origin?.actorId ? { actorId: move.origin.actorId } : {}),
          fromStatus: from,
          occurredAt: at,
          ticketId: id,
          tenantId,
          toStatus: to,
        },
      });
      if (move.eventType) {
        await transaction.outboxEvent.create({
          data: {
            ...eventOrigin(move.origin, "KDS"),
            aggregateId: id,
            aggregateType: "kds_ticket",
            outletId,
            payload: safeEventPayload({
              occurredAt: at.toISOString(),
              source: ticket.source,
              sourceReference: ticket.sourceReference,
              status: to,
              ticketId: id,
            }),
            tenantId,
            type: move.eventType,
          },
        });
      }
      return { outcome: "moved", ticket: toRecord(ticket) };
    });
  }

  async listFinishedSince(tenantId: string, outletId: string, since: Date) {
    const rows = await getPrismaClient().kdsTicket.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: ticketSelect,
      take: 200,
      where: {
        OR: [{ servedAt: { gte: since } }, { canceledAt: { gte: since } }],
        outletId,
        status: { in: ["SERVED", "CANCELED"] },
        tenantId,
      },
    });
    return rows.map(toRecord);
  }

  async listOpen(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().kdsTicket.findMany({
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: ticketSelect,
      where: { outletId, status: { in: [...OPEN_TICKET_STATUSES] }, tenantId },
    });
    return rows.map(toRecord);
  }
}
