import { formatMoneyMinor } from "@merchant/ui/money-display";

const DEFAULT_LOCALE = "id-ID";

/**
 * Formats a whole number of minor units as currency: "25000" in IDR is
 * "Rp25.000" and "1025" in USD is "$10.25". Exact for any length.
 */
export function formatMoney(valueMinor: string, currency = "IDR", locale = DEFAULT_LOCALE) {
  // Anything else is shown as it came rather than as a wrong amount.
  if (!/^-?\d+$/.test(valueMinor)) return `${valueMinor} ${currency}`;
  return formatMoneyMinor(valueMinor, { currency, locale }).replace(/\s/g, "");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
