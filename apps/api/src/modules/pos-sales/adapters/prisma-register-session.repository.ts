import { getPrismaClient, type DatabaseClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../core/audit/public.js";
import type {
  CloseFacts,
  RegisterSessionRecord,
  RegisterSessionRepository,
  ShiftMutationContext,
} from "../application/register-session.repository.js";

type TransactionClient = Pick<
  DatabaseClient,
  "auditLog" | "outboxEvent" | "posCashMovement" | "posRegisterSession"
>;

const sessionSelect = {
  cashMovements: {
    orderBy: { createdAt: "asc" },
    select: {
      amountMinor: true,
      createdAt: true,
      direction: true,
      id: true,
      idempotencyKey: true,
      reason: true,
    },
  },
  closedAt: true,
  countedCashMinor: true,
  expectedCashMinor: true,
  id: true,
  openedAt: true,
  openedBy: true,
  opener: { select: { displayName: true } },
  openingCashMinor: true,
  outletId: true,
  status: true,
  tenantId: true,
  varianceMinor: true,
  varianceReason: true,
} as const;

type SessionRow = {
  cashMovements: RegisterSessionRecord["movements"];
  opener: { displayName: string };
} & Omit<RegisterSessionRecord, "movements" | "openedByName">;

function toRecord({ cashMovements, opener, ...row }: SessionRow): RegisterSessionRecord {
  return { ...row, movements: cashMovements, openedByName: opener.displayName };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Writes the audit entry and the outbox event in the caller's transaction. */
async function recordChange(
  transaction: TransactionClient,
  options: {
    action: "pos_cash_movement.record" | "pos_register_session.close" | "pos_register_session.open";
    context: ShiftMutationContext;
    eventType?: "shift.closed.v1" | "shift.opened.v1";
    payload: Record<string, unknown>;
    session: { id: string; outletId: string; tenantId: string };
  },
) {
  await transaction.auditLog.create({
    data: {
      action: options.action,
      actorId: options.context.actorId,
      entityId: options.session.id,
      entityType: "pos_register_session",
      metadata: buildAuditMetadata(options.action, options.payload),
      outletId: options.session.outletId,
      ...(options.context.requestId ? { requestId: options.context.requestId } : {}),
      tenantId: options.session.tenantId,
    },
  });
  if (options.eventType) {
    await transaction.outboxEvent.create({
      data: {
        aggregateId: options.session.id,
        aggregateType: "pos_register_session",
        outletId: options.session.outletId,
        payload: options.payload as object,
        tenantId: options.session.tenantId,
        type: options.eventType,
      },
    });
  }
}

@Injectable()
export class PrismaRegisterSessionRepository implements RegisterSessionRepository {
  async findOpen(tenantId: string, outletId: string, cashierId: string) {
    const row = await getPrismaClient().posRegisterSession.findFirst({
      select: sessionSelect,
      where: { openedBy: cashierId, outletId, status: "OPEN", tenantId },
    });
    return row ? toRecord(row) : null;
  }

  async findById(tenantId: string, sessionId: string) {
    const row = await getPrismaClient().posRegisterSession.findUnique({
      select: sessionSelect,
      where: { tenantId_id: { id: sessionId, tenantId } },
    });
    return row ? toRecord(row) : null;
  }

  async open(
    tenantId: string,
    outletId: string,
    openingCashMinor: bigint,
    context: ShiftMutationContext,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const row = await transaction.posRegisterSession.create({
          data: { openedBy: context.actorId, openingCashMinor, outletId, tenantId },
          select: sessionSelect,
        });
        await recordChange(transaction, {
          action: "pos_register_session.open",
          context,
          eventType: "shift.opened.v1",
          payload: {
            openedAt: row.openedAt.toISOString(),
            openingCashMinor: openingCashMinor.toString(),
            shiftId: row.id,
          },
          session: row,
        });
        return toRecord(row);
      });
    } catch (error) {
      // The partial unique index allows one open shift per cashier per outlet.
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  async appendCashMovement(
    session: RegisterSessionRecord,
    movement: {
      amountMinor: bigint;
      direction: "IN" | "OUT";
      idempotencyKey: string;
      reason: string;
    },
    context: ShiftMutationContext,
  ) {
    const write = getPrismaClient().$transaction(async (transaction) => {
      // Takes the shift lock, so a movement is never added to a closing shift.
      const open = await transaction.posRegisterSession.updateMany({
        data: { updatedAt: new Date() },
        where: { id: session.id, status: "OPEN", tenantId: session.tenantId },
      });
      if (open.count !== 1) return null;
      const created = await transaction.posCashMovement.create({
        data: {
          actorId: context.actorId,
          amountMinor: movement.amountMinor,
          direction: movement.direction,
          idempotencyKey: movement.idempotencyKey,
          outletId: session.outletId,
          reason: movement.reason,
          registerSessionId: session.id,
          tenantId: session.tenantId,
        },
        select: { id: true },
      });
      await recordChange(transaction, {
        action: "pos_cash_movement.record",
        context,
        payload: {
          amountMinor: movement.amountMinor.toString(),
          direction: movement.direction,
          movementId: created.id,
          reason: movement.reason,
          shiftId: session.id,
        },
        session,
      });
      const row = await transaction.posRegisterSession.findUniqueOrThrow({
        select: sessionSelect,
        where: { tenantId_id: { id: session.id, tenantId: session.tenantId } },
      });
      return toRecord(row);
    });
    try {
      return await write;
    } catch (error) {
      // A concurrent retry with the same key already recorded the movement.
      if (!isUniqueConstraintError(error)) throw error;
      const row = await getPrismaClient().posRegisterSession.findUniqueOrThrow({
        select: sessionSelect,
        where: { tenantId_id: { id: session.id, tenantId: session.tenantId } },
      });
      return toRecord(row);
    }
  }

  async close(
    session: RegisterSessionRecord,
    decide: (locked: RegisterSessionRecord) => Promise<CloseFacts>,
    context: ShiftMutationContext,
  ) {
    const where = { tenantId_id: { id: session.id, tenantId: session.tenantId } };
    return getPrismaClient().$transaction(async (transaction) => {
      // Locks the shift row. Payments and cash movements take the same lock,
      // so everything committed before this point is visible to `decide` and
      // nothing can be added after it.
      const lock = await transaction.posRegisterSession.updateMany({
        data: { updatedAt: new Date() },
        where: { id: session.id, status: "OPEN", tenantId: session.tenantId },
      });
      if (lock.count !== 1) {
        return toRecord(
          await transaction.posRegisterSession.findUniqueOrThrow({ select: sessionSelect, where }),
        );
      }
      const facts = await decide(
        toRecord(
          await transaction.posRegisterSession.findUniqueOrThrow({ select: sessionSelect, where }),
        ),
      );
      const closedAt = new Date();
      const updated = await transaction.posRegisterSession.updateMany({
        data: {
          closedAt,
          closedBy: context.actorId,
          countedCashMinor: facts.countedCashMinor,
          expectedCashMinor: facts.expectedCashMinor,
          status: "CLOSED",
          varianceMinor: facts.varianceMinor,
          varianceReason: facts.varianceReason,
        },
        where: { id: session.id, status: "OPEN", tenantId: session.tenantId },
      });
      if (updated.count === 1) {
        await recordChange(transaction, {
          action: "pos_register_session.close",
          context,
          eventType: "shift.closed.v1",
          payload: {
            closedAt: closedAt.toISOString(),
            countedCashMinor: facts.countedCashMinor.toString(),
            expectedCashMinor: facts.expectedCashMinor.toString(),
            shiftId: session.id,
            varianceMinor: facts.varianceMinor.toString(),
          },
          session,
        });
      }
      const row = await transaction.posRegisterSession.findUniqueOrThrow({
        select: sessionSelect,
        where: { tenantId_id: { id: session.id, tenantId: session.tenantId } },
      });
      return toRecord(row);
    });
  }
}
