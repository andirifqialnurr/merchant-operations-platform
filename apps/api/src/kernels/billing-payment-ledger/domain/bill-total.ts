/** Bill arithmetic over integer minor units. Pure; no floating point. */

export type BillParts = {
  discountMinor?: bigint;
  roundingMinor?: bigint;
  serviceChargeMinor?: bigint;
  subtotalMinor: bigint;
  taxMinor?: bigint;
};

/** Subtotal minus discount, plus tax, service charge, and rounding. */
export function billTotal(parts: BillParts) {
  return (
    parts.subtotalMinor -
    (parts.discountMinor ?? 0n) +
    (parts.taxMinor ?? 0n) +
    (parts.serviceChargeMinor ?? 0n) +
    (parts.roundingMinor ?? 0n)
  );
}

/** Change owed to the customer, or null when the cash handed over is too little. */
export function cashChange(tenderedMinor: bigint, amountMinor: bigint) {
  return tenderedMinor >= amountMinor ? tenderedMinor - amountMinor : null;
}
