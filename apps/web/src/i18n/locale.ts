export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

/**
 * Picks the first supported language from an Accept-Language header, so the
 * default follows the browser. Anything unsupported falls back to Indonesian.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return { quality: quality ? Number(quality.trim().slice(2)) : 1, tag: tag.toLowerCase() };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.quality))
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

/** BCP 47 tag used for Intl formatting of numbers, money, and dates. */
export function formatLocale(locale: Locale) {
  return locale === "en" ? "en-US" : "id-ID";
}
