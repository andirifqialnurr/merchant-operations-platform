import {
  registerSessionSchema,
  type CloseRegisterSession,
  type OpenRegisterSession,
  type RecordCashMovement,
  type RegisterSession,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { decideClose, totalCash } from "../domain/register-session.js";
import {
  REGISTER_SESSION_REPOSITORY,
  type RegisterSessionRecord,
  type RegisterSessionRepository,
  type ShiftMutationContext,
} from "./register-session.repository.js";

const conflict = (code: string, message: string) => new ConflictException({ code, message });
const notFound = () =>
  new NotFoundException({ code: "POS_SHIFT_NOT_FOUND", message: "Shift not found." });

/** Maps a stored session to the cashier-facing DTO; totals are derived here. */
export function toRegisterSession(record: RegisterSessionRecord): RegisterSession {
  const totals = totalCash(record.openingCashMinor, record.movements);
  return registerSessionSchema.parse({
    cashInMinor: totals.cashInMinor.toString(),
    cashOutMinor: totals.cashOutMinor.toString(),
    closedAt: record.closedAt?.toISOString() ?? null,
    countedCashMinor: record.countedCashMinor?.toString() ?? null,
    // A closed shift reports the figure it was closed against.
    expectedCashMinor: (record.expectedCashMinor ?? totals.expectedCashMinor).toString(),
    id: record.id,
    movements: record.movements.map((movement) => ({
      amountMinor: movement.amountMinor.toString(),
      createdAt: movement.createdAt.toISOString(),
      direction: movement.direction,
      id: movement.id,
      reason: movement.reason,
    })),
    openedAt: record.openedAt.toISOString(),
    openedByName: record.openedByName,
    openingCashMinor: record.openingCashMinor.toString(),
    outletId: record.outletId,
    status: record.status,
    varianceMinor: record.varianceMinor?.toString() ?? null,
    varianceReason: record.varianceReason,
  });
}

/**
 * Use cases for a cashier's shift. A cashier only ever acts on their own
 * shift at the outlet the request is scoped to.
 */
@Injectable()
export class ShiftService {
  constructor(
    @Inject(REGISTER_SESSION_REPOSITORY) private readonly sessions: RegisterSessionRepository,
  ) {}

  async getCurrent(tenantId: string, outletId: string, cashierId: string) {
    const session = await this.sessions.findOpen(tenantId, outletId, cashierId);
    return { session: session ? toRegisterSession(session) : null };
  }

  async open(
    tenantId: string,
    outletId: string,
    input: OpenRegisterSession,
    context: ShiftMutationContext,
  ) {
    const session = await this.sessions.open(
      tenantId,
      outletId,
      BigInt(input.openingCashMinor),
      context,
    );
    if (!session) {
      throw conflict("POS_SHIFT_ALREADY_OPEN", "This cashier already has an open shift.");
    }
    return toRegisterSession(session);
  }

  async recordCashMovement(
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: RecordCashMovement,
    idempotencyKey: string,
    context: ShiftMutationContext,
  ) {
    const session = await this.requireOwnOpenSession(tenantId, outletId, sessionId, context);

    const replayed = session.movements.find((item) => item.idempotencyKey === idempotencyKey);
    if (replayed) {
      const sameRequest =
        replayed.amountMinor === BigInt(input.amountMinor) &&
        replayed.direction === input.direction &&
        replayed.reason === input.reason;
      if (!sameRequest) {
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for a different request.",
        );
      }
      return toRegisterSession(session);
    }

    const amountMinor = BigInt(input.amountMinor);
    if (input.direction === "OUT") {
      const { expectedCashMinor } = totalCash(session.openingCashMinor, session.movements);
      if (amountMinor > expectedCashMinor) {
        throw conflict("POS_CASH_OUT_EXCEEDS_DRAWER", "Cash out exceeds the cash in the drawer.");
      }
    }

    return toRegisterSession(
      await this.sessions.appendCashMovement(
        session,
        { amountMinor, direction: input.direction, idempotencyKey, reason: input.reason },
        context,
      ),
    );
  }

  async close(
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: CloseRegisterSession,
    context: ShiftMutationContext,
  ) {
    const session = await this.requireOwnSession(tenantId, outletId, sessionId, context);
    // Closing twice returns the closed shift instead of failing the retry.
    if (session.status === "CLOSED") return toRegisterSession(session);

    const { expectedCashMinor } = totalCash(session.openingCashMinor, session.movements);
    const countedCashMinor = BigInt(input.countedCashMinor);
    const decision = decideClose(countedCashMinor, expectedCashMinor, input.varianceReason);
    if (!decision.ok) {
      throw conflict(
        "POS_SHIFT_VARIANCE_REASON_REQUIRED",
        "A reason is required when counted cash differs from expected cash.",
      );
    }

    return toRegisterSession(
      await this.sessions.close(
        session,
        {
          countedCashMinor,
          expectedCashMinor,
          varianceMinor: decision.varianceMinor,
          varianceReason: decision.varianceMinor === 0n ? null : (input.varianceReason ?? null),
        },
        context,
      ),
    );
  }

  private async requireOwnSession(
    tenantId: string,
    outletId: string,
    sessionId: string,
    context: ShiftMutationContext,
  ) {
    const session = await this.sessions.findById(tenantId, sessionId);
    // Another cashier's or another outlet's shift is reported as missing.
    if (!session || session.outletId !== outletId || session.openedBy !== context.actorId) {
      throw notFound();
    }
    return session;
  }

  private async requireOwnOpenSession(
    tenantId: string,
    outletId: string,
    sessionId: string,
    context: ShiftMutationContext,
  ) {
    const session = await this.requireOwnSession(tenantId, outletId, sessionId, context);
    if (session.status !== "OPEN") {
      throw conflict("POS_SHIFT_NOT_OPEN", "This shift is already closed.");
    }
    return session;
  }
}
