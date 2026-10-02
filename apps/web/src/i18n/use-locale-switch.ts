"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { defaultLocale, isLocale, type Locale, LOCALE_COOKIE } from "./locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Native names: a language is always listed in its own language. */
export const localeOptions: readonly { label: string; value: Locale }[] = [
  { label: "Indonesia", value: "id" },
  { label: "English", value: "en" },
];

/**
 * Stores the choice in a cookie and re-renders server components in place.
 * The route does not change, so form drafts and open panels are kept.
 */
export function useLocaleSwitch() {
  const router = useRouter();
  const active = useLocale();
  return {
    locale: isLocale(active) ? active : defaultLocale,
    setLocale: (next: string) => {
      if (!isLocale(next)) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
      router.refresh();
    },
  };
}
