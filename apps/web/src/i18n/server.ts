import { cookies, headers } from "next/headers";

import { isLocale, type Locale, LOCALE_COOKIE, localeFromAcceptLanguage } from "./locale";

/**
 * Resolution order: the user's explicit choice (cookie), then the browser's
 * language, then Indonesian. There is no locale segment in the URL.
 */
export async function resolveLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function loadMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}
