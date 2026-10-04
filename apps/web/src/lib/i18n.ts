"use client";

import { useLocale, useTranslations } from "next-intl";

import { useMoneyCurrency } from "@merchant/ui/money-display";

import { formatLocale, isLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-client";

import { formatMoney } from "./format";

/** Number and money formatting in the active language. */
export function useFormat() {
  const active = useLocale();
  // The language never decides the currency: that is the workspace's choice.
  const workspaceCurrency = useMoneyCurrency();
  const locale = formatLocale(isLocale(active) ? active : "id");
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const plainNumber = new Intl.NumberFormat(locale);
  const timeOnly = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  return {
    /** Date of an ISO timestamp in the device's time zone. */
    date: (iso: string) => dateOnly.format(new Date(iso)),
    /** Date and time of an ISO timestamp in the device's time zone. */
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    /** BCP 47 tag for components that format on their own, e.g. MoneyInput. */
    locale,
    money: (valueMinor: string, currency = workspaceCurrency) =>
      formatMoney(valueMinor, currency, locale),
    /** Time of day of an ISO timestamp in the device's time zone. */
    time: (iso: string) => timeOnly.format(new Date(iso)),
    /** A count with the language's digit grouping. */
    number: (value: number) => plainNumber.format(value),
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
