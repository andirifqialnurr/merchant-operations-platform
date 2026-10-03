/**
 * Shift cash rules. Pure functions over integer minor units: no framework,
 * no database, no floating point.
 */

export type CashMovementFact = { amountMinor: bigint; direction: "IN" | "OUT" };

export type CashTotals = {
  cashInMinor: bigint;
  cashOutMinor: bigint;
  /** Cash that should be in the drawer: opening + sales - refunds + in - out. */
  expectedCashMinor: bigint;
};

export function totalCash(
  openingCashMinor: bigint,
  movements: readonly CashMovementFact[],
  cashSalesMinor = 0n,
  cashRefundsMinor = 0n,
): CashTotals {
  let cashInMinor = 0n;
  let cashOutMinor = 0n;
  for (const movement of movements) {
    if (movement.direction === "IN") cashInMinor += movement.amountMinor;
    else cashOutMinor += movement.amountMinor;
  }
  return {
    cashInMinor,
    cashOutMinor,
    expectedCashMinor:
      openingCashMinor + cashSalesMinor - cashRefundsMinor + cashInMinor - cashOutMinor,
  };
}

/** Counted minus expected: positive means surplus, negative means shortage. */
export function cashVariance(countedCashMinor: bigint, expectedCashMinor: bigint) {
  return countedCashMinor - expectedCashMinor;
}

export type CloseDecision =
  { ok: true; varianceMinor: bigint } | { ok: false; reason: "VARIANCE_REASON_REQUIRED" };

/** A shift that does not balance can only be closed with a reason. */
export function decideClose(
  countedCashMinor: bigint,
  expectedCashMinor: bigint,
  varianceReason: string | undefined,
): CloseDecision {
  const varianceMinor = cashVariance(countedCashMinor, expectedCashMinor);
  if (varianceMinor !== 0n && !varianceReason?.trim()) {
    return { ok: false, reason: "VARIANCE_REASON_REQUIRED" };
  }
  return { ok: true, varianceMinor };
}
