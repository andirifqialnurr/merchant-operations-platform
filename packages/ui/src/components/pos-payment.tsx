import type { MoneyMinorValue } from "./money-display";

function toMinorBigInt(value: MoneyMinorValue) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Cash total must be a safe integer in minor units.");
    }
    return BigInt(value);
  }
  if (!/^\d+$/.test(value)) {
    throw new TypeError("Cash total must be a non-negative integer in minor units.");
  }
  return BigInt(value);
}

function roundUp(value: bigint, step: bigint) {
  return ((value + step - 1n) / step) * step;
}

/**
 * Notes a customer is likely to hand over, in minor units: Rp10.000, Rp50.000,
 * and Rp100.000; $5, $10, and $20.
 */
const CASH_STEPS: Record<string, readonly bigint[]> = {
  IDR: [10_000n, 50_000n, 100_000n],
  USD: [500n, 1_000n, 2_000n],
};

/** The exact amount first, then the total rounded up to common notes of the currency. */
export function buildCashPresets(totalMinor: MoneyMinorValue, currency = "IDR") {
  const total = toMinorBigInt(totalMinor);
  if (total < 0n) throw new RangeError("Cash total must not be negative.");
  // A currency without known notes offers the exact amount only.
  const steps = CASH_STEPS[currency.trim().toUpperCase()] ?? [];
  return Array.from(new Set([total, ...steps.map((step) => roundUp(total, step))].map(String)));
}
