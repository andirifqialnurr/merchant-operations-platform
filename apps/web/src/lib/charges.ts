import { computeCharges, formatRatePercent, type OutletCharges } from "@merchant/contracts";

/** "5" or "5,5" for a label such as "Pajak (5,5%)". */
export function ratePercent(bp: number, locale: string) {
  return formatRatePercent(bp, locale.startsWith("id") ? "," : ".");
}

/**
 * What a customer pays for a sum of menu prices at this outlet, and the parts
 * to list when tax or service is added on top. Nothing is listed when they are
 * already in the price or when the outlet charges neither.
 */
export function payable(menuTotalMinor: bigint, charges: OutletCharges) {
  const parts = computeCharges(menuTotalMinor, charges);
  const added = !charges.included && (charges.serviceChargeRateBp > 0 || charges.taxRateBp > 0);
  return { added, parts, totalMinor: parts.totalMinor };
}
