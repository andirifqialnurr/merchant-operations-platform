import {
  registerSessionSchema,
  type CloseRegisterSession,
  type OpenRegisterSession,
  type RecordCashMovement,
  type RegisterSession,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
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
const notOpen = () => conflict("POS_SHIFT_NOT_OPEN", "This shift is already closed.");

/** Maps a stored session to the cashier-facing DTO; totals are derived here. */
export function toRegisterSession(
  record: RegisterSessionRecord,
  cashSalesMinor: bigint,
  nonCashPayments: readonly { amountMinor: bigint; method: string }[] = [],
  cashRefundsMinor = 0n,
): RegisterSession {
  const totals = totalCash(
    record.openingCashMinor,
    record.movements,
    cashSalesMinor,
    cashRefundsMinor,
  );
  return registerSessionSchema.parse({
    cashInMinor: totals.cashInMinor.toString(),
    cashOutMinor: totals.cashOutMinor.toString(),
    cashRefundsMinor: cashRefundsMinor.toString(),
    cashSalesMinor: cashSalesMinor.toString(),
    nonCashPayments: nonCashPayments.map((payment) => ({
      amountMinor: payment.amountMinor.toString(),
      method: payment.method,
    })),
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
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  private async present(record: RegisterSessionRecord) {
    const taken = await this.billing.paymentsInSession(record.tenantId, record.id);
    return toRegisterSession(record, taken.cashMinor, taken.nonCash, taken.cashRefundsMinor);
  }

  /** The cash the drawer of the cashier's open shift should hold right now. */
  async expectedCash(tenantId: string, outletId: string, cashierId: string) {
    const current = await this.getCurrent(tenantId, outletId, cashierId);
    return current.session ? BigInt(current.session.expectedCashMinor) : null;
  }

  /** The cashier's open shift at the outlet, or null. Payments are taken in it. */
  findOpen(tenantId: string, outletId: string, cashierId: string) {
    return this.sessions.findOpen(tenantId, outletId, cashierId);
  }

  async getCurrent(tenantId: string, outletId: string, cashierId: string) {
    const session = await this.sessions.findOpen(tenantId, outletId, cashierId);
    return { session: session ? await this.present(session) : null };
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
    return toRegisterSession(session, 0n);
  }

  async recordCashMovement(
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: RecordCashMovement,
    idempotencyKey: string,
    context: ShiftMutationContext,
  ) {
    const session = await this.requireOwnSession(tenantId, outletId, sessionId, context);
    if (session.status !== "OPEN") throw notOpen();

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
      return this.present(session);
    }

    const amountMinor = BigInt(input.amountMinor);
    if (input.direction === "OUT") {
      const { expectedCashMinor } = totalCash(
        session.openingCashMinor,
        session.movements,
        await this.billing.cashReceivedInSession(tenantId, session.id),
      );
      if (amountMinor > expectedCashMinor) {
        throw conflict("POS_CASH_OUT_EXCEEDS_DRAWER", "Cash out exceeds the cash in the drawer.");
      }
    }

    const updated = await this.sessions.appendCashMovement(
      session,
      { amountMinor, direction: input.direction, idempotencyKey, reason: input.reason },
      context,
    );
    if (!updated) throw notOpen();
    return this.present(updated);
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
    if (session.status === "CLOSED") return this.present(session);

    const countedCashMinor = BigInt(input.countedCashMinor);
    const closed = await this.sessions.close(
      session,
      // Runs once the shift is locked, so no payment or cash movement can
      // slip in between totalling the cash and closing.
      async (locked) => {
        const { expectedCashMinor } = totalCash(
          locked.openingCashMinor,
          locked.movements,
          await this.billing.cashReceivedInSession(tenantId, locked.id),
        );
        const decision = decideClose(countedCashMinor, expectedCashMinor, input.varianceReason);
        if (!decision.ok) {
          throw conflict(
            "POS_SHIFT_VARIANCE_REASON_REQUIRED",
            "A reason is required when counted cash differs from expected cash.",
          );
        }
        return {
          countedCashMinor,
          expectedCashMinor,
          varianceMinor: decision.varianceMinor,
          varianceReason: decision.varianceMinor === 0n ? null : (input.varianceReason ?? null),
        };
      },
      context,
    );
    return this.present(closed);
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
}
