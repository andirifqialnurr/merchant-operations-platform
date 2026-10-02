import type { CashMovementDirection, RegisterSessionStatus } from "@merchant/contracts";

export type ShiftMutationContext = { actorId: string; requestId?: string };

export type CashMovementRecord = {
  amountMinor: bigint;
  createdAt: Date;
  direction: CashMovementDirection;
  id: string;
  idempotencyKey: string;
  reason: string;
};

export type RegisterSessionRecord = {
  closedAt: Date | null;
  countedCashMinor: bigint | null;
  expectedCashMinor: bigint | null;
  id: string;
  movements: CashMovementRecord[];
  openedAt: Date;
  openedBy: string;
  openedByName: string;
  openingCashMinor: bigint;
  outletId: string;
  status: RegisterSessionStatus;
  tenantId: string;
  varianceMinor: bigint | null;
  varianceReason: string | null;
};

export type CloseFacts = {
  countedCashMinor: bigint;
  expectedCashMinor: bigint;
  varianceMinor: bigint;
  varianceReason: string | null;
};

/**
 * Persistence port for POS shifts. Every method is scoped by tenant, so a
 * session id from another workspace is simply not found.
 */
export interface RegisterSessionRepository {
  appendCashMovement(
    session: RegisterSessionRecord,
    movement: {
      amountMinor: bigint;
      direction: CashMovementDirection;
      idempotencyKey: string;
      reason: string;
    },
    context: ShiftMutationContext,
  ): Promise<RegisterSessionRecord>;
  close(
    session: RegisterSessionRecord,
    facts: CloseFacts,
    context: ShiftMutationContext,
  ): Promise<RegisterSessionRecord>;
  findById(tenantId: string, sessionId: string): Promise<RegisterSessionRecord | null>;
  findOpen(
    tenantId: string,
    outletId: string,
    cashierId: string,
  ): Promise<RegisterSessionRecord | null>;
  /** Returns null when the cashier already has an open shift at the outlet. */
  open(
    tenantId: string,
    outletId: string,
    openingCashMinor: bigint,
    context: ShiftMutationContext,
  ): Promise<RegisterSessionRecord | null>;
}

export const REGISTER_SESSION_REPOSITORY = Symbol("REGISTER_SESSION_REPOSITORY");
