import * as z from "zod";

/** A rate in basis points: 1100 is 11%, 550 is 5.5%. Whole numbers only, so nothing is rounded twice. */
export const chargeRateBpSchema = z.number().int().min(0).max(5_000);

/**
 * How an outlet charges tax and service on top of menu prices. The default,
 * included with both rates at zero, is the M1 rule: the menu price is the
 * final price and nothing else is shown.
 */
export const outletChargesSchema = z.object({
  /**
   * True: the menu price already holds tax and service ("harga sudah
   * termasuk"). False: they are added on the receipt ("ditambahkan di struk").
   */
  included: z.boolean(),
  serviceChargeRateBp: chargeRateBpSchema,
  taxRateBp: chargeRateBpSchema,
});

export type OutletCharges = z.infer<typeof outletChargesSchema>;

export const NO_CHARGES: OutletCharges = { included: true, serviceChargeRateBp: 0, taxRateBp: 0 };

export type ChargeBreakdown = {
  /** The amount before service and tax. */
  baseMinor: bigint;
  serviceChargeMinor: bigint;
  taxMinor: bigint;
  /** What the customer pays. Always base + service + tax. */
  totalMinor: bigint;
};

const BP = 10_000n;

/** Whole minor units, halves rounded up. */
function divideRounded(numerator: bigint, denominator: bigint) {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * Splits the sum of menu prices into base, service charge, and tax. Service is
 * charged on the base and tax on base plus service. The same function runs on
 * the server when a bill is made and in the cashier screen before paying, so
 * both always show the same total. The parts always add up to the total
 * exactly: the last part takes whatever rounding leaves.
 */
export function computeCharges(menuSubtotalMinor: bigint, charges: OutletCharges): ChargeBreakdown {
  if (menuSubtotalMinor < 0n) throw new RangeError("The subtotal must not be negative.");
  const service = BigInt(charges.serviceChargeRateBp);
  const tax = BigInt(charges.taxRateBp);

  if (!charges.included) {
    const serviceChargeMinor = divideRounded(menuSubtotalMinor * service, BP);
    const taxMinor = divideRounded((menuSubtotalMinor + serviceChargeMinor) * tax, BP);
    return {
      baseMinor: menuSubtotalMinor,
      serviceChargeMinor,
      taxMinor,
      totalMinor: menuSubtotalMinor + serviceChargeMinor + taxMinor,
    };
  }

  // Taken out from the outside in: first the tax, then the service inside what is left.
  const beforeTax = divideRounded(menuSubtotalMinor * BP, BP + tax);
  const baseMinor = divideRounded(beforeTax * BP, BP + service);
  return {
    baseMinor,
    serviceChargeMinor: beforeTax - baseMinor,
    taxMinor: menuSubtotalMinor - beforeTax,
    totalMinor: menuSubtotalMinor,
  };
}

/** "11" or "5,5" as typed by a person, to basis points; undefined when it is not a rate. */
export function parseRatePercent(text: string): number | undefined {
  const match = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return undefined;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return chargeRateBpSchema.safeParse(bp).success ? bp : undefined;
}

/** 1100 → "11", 550 → "5.5" (or "5,5" with a comma as the decimal mark). */
export function formatRatePercent(bp: number, decimalMark = ".") {
  const whole = Math.floor(bp / 100);
  const fraction = String(bp % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}${decimalMark}${fraction}` : String(whole);
}
