const DEFAULT_LOCALE = "id-ID";

/** Formats an integer minor-unit string as currency, e.g. "25000" -> "Rp25.000". */
export function formatMoney(valueMinor: string, currency = "IDR", locale = DEFAULT_LOCALE) {
  const amount = Number(valueMinor);
  if (!Number.isSafeInteger(amount)) return `${valueMinor} ${currency}`;
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  })
    .format(amount)
    .replace(/\s/g, "");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
