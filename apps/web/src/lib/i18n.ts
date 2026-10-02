"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatLocale, isLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-client";

import { formatMoney } from "./format";

/** Number and money formatting in the active language. */
export function useFormat() {
  const active = useLocale();
  const locale = formatLocale(isLocale(active) ? active : "id");
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return {
    /** Date and time of an ISO timestamp in the device's time zone. */
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    /** BCP 47 tag for components that format on their own, e.g. MoneyInput. */
    locale,
    money: (valueMinor: string, currency?: string) => formatMoney(valueMinor, currency, locale),
  };
}

/**
 * Translates an error by its stable API code. The server's own message is
 * never shown: it is not localized and may change.
 */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return (error: unknown) => {
    if (error instanceof ApiClientError) {
      if (t.has(error.code as never)) return t(error.code as never);
      if (error.requestId) return t("UNKNOWN_WITH_ID", { requestId: error.requestId });
    }
    return t("UNKNOWN");
  };
}
