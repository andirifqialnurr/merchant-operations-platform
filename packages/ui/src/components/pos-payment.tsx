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

export function buildCashPresets(totalMinor: MoneyMinorValue) {
  const total = toMinorBigInt(totalMinor);
  if (total < 0n) throw new RangeError("Cash total must not be negative.");
  return Array.from(
    new Set(
      [total, roundUp(total, 10_000n), roundUp(total, 50_000n), roundUp(total, 100_000n)].map(
        String,
      ),
    ),
  );
}
